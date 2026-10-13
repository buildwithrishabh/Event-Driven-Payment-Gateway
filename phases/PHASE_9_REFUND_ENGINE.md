# Phase 9: Production-Grade Refund Engine

## Objective
Implement an asynchronous, idempotent, and ledger-integrated **Refund Processing Engine** powered by Razorpay. 

In a production-grade distributed payment gateway, refunds cannot be a simple synchronous API call. They must guarantee:
1. **Zero Over-Refunding**: Atomic validations so concurrent refund requests cannot refund more than the original payment amount.
2. **ACID Consistency**: Atomic creation of the refund record, payment balance adjustment, and Transactional Outbox event.
3. **Asynchronous Processor Execution**: BullMQ worker calling Razorpay's refund API (`payments.refund`) with retry mechanisms.
4. **Double-Entry Financial Accuracy**: Creating an immutable `DEBIT` entry in the ledger when the refund succeeds.
5. **Merchant Notifications**: Disagree-free webhook event dispatches (`refund.succeeded`, `refund.failed`).

---

## 1. Refund State Lifecycle & Architecture

```
Merchant Client
      │
      │ 1. POST /v1/refunds (Idempotency-Key)
      ▼
┌────────────────────────────────────────────────────────┐
│ Express API Layer                                      │
│  - Validate Merchant API Key                           │
│  - Check Idempotency Key (Redis)                       │
│  - Verify Payment is SUCCEEDED                         │
│  - Verify (amount + refundedAmount) <= payment.amount   │
│  - Mongo Transaction:                                  │
│    ├── Create Refund (Status: 'PENDING')               │
│    ├── Increment payment.refundedAmount                │
│    └── Insert OutboxEvent ('REFUND_CREATED')           │
└──────────────────────────┬─────────────────────────────┘
                           │
                           │ 2. Enqueue BullMQ Job
                           ▼
┌────────────────────────────────────────────────────────┐
│ BullMQ Worker (refund.worker.js)                       │
│  - Claim Refund atomically in DB ('PROCESSING')        │
│  - Call Razorpay API: payments.refund(paymentId)       │
│  - On Success:                                         │
│    ├── Status -> 'SUCCEEDED'                           │
│    ├── Record Ledger DEBIT entry                       │
│    └── Enqueue Webhook: 'refund.succeeded'             │
│  - On Failure:                                         │
│    ├── Status -> 'FAILED'                              │
│    ├── Rollback payment.refundedAmount                 │
│    └── Enqueue Webhook: 'refund.failed'                │
└────────────────────────────────────────────────────────┘
```

---

## 2. Project Files to Create & Update

```text
backend/src/
├── modules/
│   ├── payments/
│   │   └── payment.model.js        <-- Update with refund tracking fields
│   └── refunds/
│       ├── refund.model.js         <-- New
│       ├── refund.service.js       <-- New
│       ├── refund.controller.js    <-- New
│       └── refund.routes.js        <-- New
├── queues/
│   └── refund.queue.js             <-- New BullMQ Queue
├── workers/
│   └── refund.worker.js            <-- New BullMQ Worker
└── app.js                          <-- Mount /v1/refunds route
```

---

## 3. Code Implementation

### Step 1: Update Payment Model (`src/modules/payments/payment.model.js`)

Add fields to track cumulative refunds and refund statuses:

```javascript
// Ensure these fields exist on paymentSchema:
refundedAmount: {
  type: Number,
  default: 0,
  min: 0,
},
refundStatus: {
  type: String,
  enum: ['NONE', 'PARTIAL', 'FULL'],
  default: 'NONE',
  index: true,
},
```

---

### Step 2: Refund Model (`src/modules/refunds/refund.model.js`)

Create the schema for tracking individual refund requests:

```javascript
import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
      index: true,
    },
    processorPaymentId: {
      type: String, // Razorpay payment id (pay_xxx)
      required: true,
    },
    processorRefundId: {
      type: String, // Razorpay refund id (rfn_xxx)
      sparse: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1, // Integer in smallest currency unit (e.g., paisa or cents)
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    reason: {
      type: String,
      default: 'requested_by_customer',
    },
    failureReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Fast compound lookup for merchant refund lists
refundSchema.index({ merchantId: 1, createdAt: -1 });

export const Refund = mongoose.model('Refund', refundSchema);
```

---

### Step 3: Refund Queue (`src/queues/refund.queue.js`)

Create a dedicated BullMQ queue for refund jobs:

```javascript
import { Queue } from 'bullmq';
import { redisClient } from '../config/redis.js';

export const REFUND_QUEUE_NAME = 'refund-processing-queue';

export const refundQueue = new Queue(REFUND_QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
```

---

### Step 4: Refund Service (`src/modules/refunds/refund.service.js`)

Handles atomic validation, race condition prevention, and the transactional outbox:

```javascript
import mongoose from 'mongoose';
import { Payment } from '../payments/payment.model.js';
import { Refund } from './refund.model.js';
import { OutboxEvent } from '../payments/outbox.model.js';
import { refundQueue } from '../../queues/refund.queue.js';

export class RefundService {
  /**
   * Request a refund with ACID guarantees and Outbox pattern
   */
  static async createRefund({ merchantId, paymentId, amount, reason }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Fetch payment with session lock
      const payment = await Payment.findOne({
        _id: paymentId,
        merchantId,
      }).session(session);

      if (!payment) {
        throw { statusCode: 404, message: 'Payment not found' };
      }

      if (payment.status !== 'SUCCEEDED') {
        throw {
          statusCode: 400,
          message: `Cannot refund payment with status '${payment.status}'. Only SUCCEEDED payments can be refunded.`,
        };
      }

      // Default to full refund if amount is not specified
      const refundAmount = amount ? Number(amount) : (payment.amount - (payment.refundedAmount || 0));

      if (refundAmount <= 0) {
        throw { statusCode: 400, message: 'Refund amount must be greater than zero.' };
      }

      const currentRefunded = payment.refundedAmount || 0;
      const remainingRefundable = payment.amount - currentRefunded;

      if (refundAmount > remainingRefundable) {
        throw {
          statusCode: 400,
          message: `Refund amount exceeds refundable balance. Remaining refundable: ${remainingRefundable}`,
        };
      }

      // 2. Create Refund Record in PENDING state
      const [refund] = await Refund.create(
        [
          {
            merchantId,
            paymentId: payment._id,
            processorPaymentId: payment.processorPaymentId || payment.processorTransactionId,
            amount: refundAmount,
            currency: payment.currency,
            reason: reason || 'requested_by_customer',
            status: 'PENDING',
          },
        ],
        { session }
      );

      // 3. Atomically update Payment refunded amount and status
      const newTotalRefunded = currentRefunded + refundAmount;
      payment.refundedAmount = newTotalRefunded;
      payment.refundStatus = newTotalRefunded === payment.amount ? 'FULL' : 'PARTIAL';
      await payment.save({ session });

      // 4. Record Transactional Outbox Event
      await OutboxEvent.create(
        [
          {
            aggregateId: refund._id,
            eventType: 'REFUND_CREATED',
            payload: {
              refundId: refund._id,
              paymentId: payment._id,
              amount: refundAmount,
              processorPaymentId: refund.processorPaymentId,
            },
            status: 'PENDING',
          },
        ],
        { session }
      );

      await session.commitTransaction();

      // 5. Enqueue BullMQ job
      await refundQueue.add(
        'process-refund',
        { refundId: refund._id.toString() },
        { jobId: `refund_${refund._id}` }
      );

      return refund;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async getRefundById(refundId, merchantId) {
    return await Refund.findOne({ _id: refundId, merchantId });
  }

  static async getRefundsForPayment(paymentId, merchantId) {
    return await Refund.find({ paymentId, merchantId }).sort({ createdAt: -1 });
  }
}
```

---

### Step 5: Refund Worker (`src/workers/refund.worker.js`)

Executes the processor call via Razorpay, writes ledger DEBIT entries, and emits webhooks:

```javascript
import { Worker } from 'bullmq';
import { redisClient } from '../config/redis.js';
import { razorpayClient } from '../config/razorpay.js';
import { Refund } from '../modules/refunds/refund.model.js';
import { Payment } from '../modules/payments/payment.model.js';
import { LedgerService } from '../modules/ledger/ledger.service.js';
import { webhookQueue } from '../queues/webhook.queue.js'; // From Phase 7
import { REFUND_QUEUE_NAME } from '../queues/refund.queue.js';

export const refundWorker = new Worker(
  REFUND_QUEUE_NAME,
  async (job) => {
    const { refundId } = job.data;
    console.log(`💸 Processing refund job: ${refundId}`);

    // Atomically claim refund to avoid duplicate processing
    const refund = await Refund.findOneAndUpdate(
      { _id: refundId, status: { $in: ['PENDING', 'PROCESSING'] } },
      { $set: { status: 'PROCESSING' } },
      { new: true }
    );

    if (!refund) {
      console.warn(`Refund ${refundId} already processed or does not exist.`);
      return;
    }

    try {
      // 1. Call Razorpay API to execute refund
      // Razorpay expects: razorpay.payments.refund(paymentId, { amount, notes })
      const razorpayResponse = await razorpayClient.payments.refund(
        refund.processorPaymentId,
        {
          amount: refund.amount,
          notes: {
            reason: refund.reason,
            gatewayRefundId: refund._id.toString(),
          },
        }
      );

      // 2. Mark Refund as SUCCEEDED
      refund.status = 'SUCCEEDED';
      refund.processorRefundId = razorpayResponse.id;
      await refund.save();

      // 3. Record Immutable Ledger DEBIT entry (Reverses collected funds)
      await LedgerService.recordDebit({
        merchantId: refund.merchantId,
        paymentId: refund.paymentId,
        refundId: refund._id,
        amount: refund.amount,
        currency: refund.currency,
        description: `Refund executed for payment ${refund.paymentId}`,
      });

      console.log(`✅ Refund ${refund._id} SUCCEEDED (Razorpay ID: ${razorpayResponse.id})`);

      // 4. Emit Webhook event to merchant
      if (webhookQueue) {
        await webhookQueue.add('dispatch-webhook', {
          merchantId: refund.merchantId.toString(),
          event: 'refund.succeeded',
          payload: {
            refundId: refund._id,
            paymentId: refund.paymentId,
            amount: refund.amount,
            currency: refund.currency,
            status: 'SUCCEEDED',
            processorRefundId: refund.processorRefundId,
          },
        });
      }
    } catch (error) {
      console.error(`❌ Refund ${refund._id} failed:`, error?.message || error);

      // Rollback payment.refundedAmount in DB on terminal failure
      if (job.attemptsMade >= (job.opts.attempts || 5)) {
        refund.status = 'FAILED';
        refund.failureReason = error?.error?.description || error?.message || 'Upstream processor rejected refund';
        await refund.save();

        // Decrement payment's refundedAmount since this refund permanently failed
        await Payment.findByIdAndUpdate(refund.paymentId, {
          $inc: { refundedAmount: -refund.amount },
          $set: { refundStatus: 'PARTIAL' },
        });

        if (webhookQueue) {
          await webhookQueue.add('dispatch-webhook', {
            merchantId: refund.merchantId.toString(),
            event: 'refund.failed',
            payload: {
              refundId: refund._id,
              paymentId: refund.paymentId,
              amount: refund.amount,
              status: 'FAILED',
              reason: refund.failureReason,
            },
          });
        }
      }

      throw error; // Let BullMQ retry according to backoff strategy
    }
  },
  {
    connection: redisClient,
    concurrency: 5,
  }
);
```

---

### Step 6: Add Ledger Debit Method (`src/modules/ledger/ledger.service.js`)

Ensure [src/modules/ledger/ledger.service.js](file:///d:/Backend/Backend%20Projects/Distributed%20Payment%20Gateway/backend/src/modules/ledger/ledger.service.js) includes the `recordDebit` helper:

```javascript
// Inside LedgerService class:
static async recordDebit({ merchantId, paymentId, refundId, amount, currency, description }) {
  const existing = await LedgerEntry.findOne({ refundId, type: 'DEBIT' });
  if (existing) {
    return existing;
  }

  return await LedgerEntry.create({
    merchantId,
    paymentId,
    refundId,
    type: 'DEBIT',
    amount,
    currency,
    description: description || `Refund debit for ${paymentId}`,
  });
}
```

---

### Step 7: Controller & Routes (`src/modules/refunds/`)

#### Controller: `src/modules/refunds/refund.controller.js`

```javascript
import { RefundService } from './refund.service.js';

export class RefundController {
  static async createRefund(req, res) {
    try {
      const { paymentId, amount, reason } = req.body;

      if (!paymentId) {
        return res.status(400).json({ error: 'paymentId is required.' });
      }

      const refund = await RefundService.createRefund({
        merchantId: req.merchant._id,
        paymentId,
        amount,
        reason,
      });

      return res.status(202).json({
        message: 'Refund initiated successfully',
        refund,
      });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        error: error.message || 'Internal server error',
      });
    }
  }

  static async getRefund(req, res) {
    try {
      const refund = await RefundService.getRefundById(req.params.id, req.merchant._id);
      if (!refund) {
        return res.status(404).json({ error: 'Refund not found' });
      }
      return res.json({ refund });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to retrieve refund' });
    }
  }

  static async listPaymentRefunds(req, res) {
    try {
      const refunds = await RefundService.getRefundsForPayment(req.params.paymentId, req.merchant._id);
      return res.json({ refunds });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to retrieve refunds' });
    }
  }
}
```

#### Routes: `src/modules/refunds/refund.routes.js`

```javascript
import { Router } from 'express';
import { RefundController } from './refund.controller.js';
import { authenticateApiKey } from '../../middleware/auth.js';
import { idempotencyMiddleware } from '../../middleware/idempotency.js';

const router = Router();

// Create Refund (Requires API Key & Idempotency Header)
router.post('/', authenticateApiKey, idempotencyMiddleware, RefundController.createRefund);

// Get single refund by ID
router.get('/:id', authenticateApiKey, RefundController.getRefund);

// Get all refunds for a specific payment
router.get('/payment/:paymentId', authenticateApiKey, RefundController.listPaymentRefunds);

export default router;
```

---

### Step 8: Register Routes in `src/app.js`

```javascript
import refundRoutes from './modules/refunds/refund.routes.js';

// Mount refund routes
app.use('/v1/refunds', refundRoutes);
```

---

## 4. How to Test & Verify

### 1. Issue a Full or Partial Refund
```bash
curl -i -X POST http://localhost:3000/v1/refunds \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_MERCHANT_API_KEY" \
  -H "Idempotency-Key: refund_idem_1001" \
  -d '{
    "paymentId": "67a9...",
    "amount": 500,
    "reason": "customer_requested_return"
  }'
```

**Expected Response (`202 Accepted`):**
```json
{
  "message": "Refund initiated successfully",
  "refund": {
    "_id": "67b1...",
    "paymentId": "67a9...",
    "amount": 500,
    "currency": "INR",
    "status": "PENDING",
    "reason": "customer_requested_return"
  }
}
```

---

### 2. Verify Ledger Balance Adjusted Automatically
Query the merchant ledger balance:
```bash
curl -i http://localhost:3000/v1/ledger/balance \
  -H "x-api-key: YOUR_MERCHANT_API_KEY"
```

Notice `totalDebits` is incremented by 500, and `availableBalance` is reduced accordingly:
```json
{
  "balance": {
    "currency": "INR",
    "availableBalance": 4500,
    "totalCredits": 5000,
    "totalDebits": 500
  }
}
```

---

### 3. Verify Over-Refund Prevention (Edge Case Test)
Try requesting another refund with amount exceeding the remaining balance (e.g., amount = 4800 on a 5000 payment where 500 is already refunded):
```bash
curl -i -X POST http://localhost:3000/v1/refunds \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_MERCHANT_API_KEY" \
  -H "Idempotency-Key: refund_idem_excess" \
  -d '{
    "paymentId": "67a9...",
    "amount": 4800
  }'
```

**Expected Response (`400 Bad Request`):**
```json
{
  "error": "Refund amount exceeds refundable balance. Remaining refundable: 4500"
}
```

---

## Production Checklist for Phase 9
- [ ] Refunds reject non-`SUCCEEDED` payments.
- [ ] Race conditions & double-refunding prevented by MongoDB transactional bounds.
- [ ] BullMQ asynchronously contacts Razorpay's refund API with exponential backoff.
- [ ] Successful refunds write an immutable `DEBIT` entry into the financial Ledger.
- [ ] Webhook triggers notify the merchant on refund completion (`refund.succeeded`).

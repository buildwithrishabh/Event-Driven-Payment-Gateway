# Phase 4: Payment Service & Transactional Outbox Pattern

## Objective
Implement payment creation with safe state lifecycle and the **Transactional Outbox Pattern**. This guarantees that a payment record and its corresponding event are saved atomically in MongoDB within a single transaction, completely eliminating the "dual-write" failure problem before dispatching to the Razorpay background worker.

---

## 1. Why The Transactional Outbox Pattern?

### The Problem (Direct Queue Publishing):
```text
1. Save Payment to MongoDB  --> SUCCEEDS
2. Publish to BullMQ Queue  --> NETWORK FAILS / BROKER DOWN
Result: Payment exists in DB, but no worker is notified. Money is lost in limbo!
```

### The Solution (Outbox Pattern):
```text
[ Single MongoDB Transaction (ACID) ]
┌──────────────────────────────────────┐
│ 1. Save Payment (status: CREATED)    │
│ 2. Save Outbox Event (status: PENDING)│
└──────────────────────────────────────┘
                  │ (Committed atomically)
                  v
Outbox Relay publishes to BullMQ Queue and marks Outbox Event as PROCESSED.
                  v
BullMQ Worker calls Razorpay API to generate upstream Order / charge.
```

---

## 2. Project Files to Create

```text
backend/src/
└── modules/
    └── payments/
        ├── payment.model.js
        ├── outbox.model.js
        ├── payment.controller.js
        └── payment.routes.js
```

---

## 3. Code Implementation

### Step 1: Payment Model (`src/modules/payments/payment.model.js`)

> **Rule:** Always store amounts as integers in minor units (e.g., paise for INR: ₹100.00 = `10000`, cents for USD: $10.00 = `1000`). Never store floating-point values like `10.99` directly!

```javascript
import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 100 // In minor units (e.g., 10000 paise = 100 INR)
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'INR'
    },
    status: {
      type: String,
      enum: ['CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'],
      default: 'CREATED',
      index: true
    },
    customerEmail: {
      type: String,
      required: true
    },
    customerPhone: {
      type: String,
      default: null
    },
    // Upstream Razorpay references
    razorpayOrderId: {
      type: String,
      default: null,
      index: true
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      index: true
    },
    razorpaySignature: {
      type: String,
      default: null
    },
    failureReason: {
      type: String,
      default: null
    },
    processingLock: {
      workerId: { type: String, default: null },
      lockedAt: { type: Date, default: null }
    }
  },
  {
    timestamps: true
  }
);

export const Payment = mongoose.model('Payment', paymentSchema);
```

---

### Step 2: Outbox Model (`src/modules/payments/outbox.model.js`)

```javascript
import mongoose from 'mongoose';

const outboxSchema = new mongoose.Schema(
  {
    aggregateType: {
      type: String,
      required: true,
      default: 'PAYMENT'
    },
    aggregateId: {
      type: String,
      required: true,
      index: true
    },
    eventType: {
      type: String,
      required: true // e.g. "PAYMENT_CREATED"
    },
    payload: {
      type: Object,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSED', 'FAILED'],
      default: 'PENDING',
      index: true
    },
    retryCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Index to quickly fetch pending events in FIFO order
outboxSchema.index({ status: 1, createdAt: 1 });

export const OutboxEvent = mongoose.model('OutboxEvent', outboxSchema);
```

---

### Step 3: Payment Controller (`src/modules/payments/payment.controller.js`)

```javascript
import mongoose from 'mongoose';
import { Payment } from './payment.model.js';
import { OutboxEvent } from './outbox.model.js';

// POST /v1/payments
export async function createPayment(req, res) {
  const { amount, currency, customerEmail, customerPhone } = req.body;

  if (!amount || !customerEmail) {
    return res.status(400).json({
      error: 'amount and customerEmail are required'
    });
  }

  // Start MongoDB Multi-Document ACID Transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Create Payment in CREATED state
    const [payment] = await Payment.create(
      [
        {
          merchantId: req.merchant._id,
          amount,
          currency: (currency || 'INR').toUpperCase(),
          customerEmail,
          customerPhone: customerPhone || null,
          status: 'CREATED'
        }
      ],
      { session }
    );

    // 2. Insert Outbox Event in the same transaction
    await OutboxEvent.create(
      [
        {
          aggregateType: 'PAYMENT',
          aggregateId: payment._id.toString(),
          eventType: 'PAYMENT_CREATED',
          payload: {
            paymentId: payment._id.toString(),
            merchantId: req.merchant._id,
            amount: payment.amount,
            currency: payment.currency,
            customerEmail: payment.customerEmail
          },
          status: 'PENDING'
        }
      ],
      { session }
    );

    // Commit both writes atomically
    await session.commitTransaction();

    return res.status(201).json({
      paymentId: payment._id,
      merchantId: payment.merchantId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.createdAt
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Failed to create payment:', error);
    return res.status(500).json({ error: 'Failed to initiate payment transaction' });
  } finally {
    session.endSession();
  }
}

// GET /v1/payments/:id
export async function getPaymentById(req, res) {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      merchantId: req.merchant._id
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    return res.json(payment);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve payment' });
  }
}
```

---

### Step 4: Payment Routes (`src/modules/payments/payment.routes.js`)

```javascript
import { Router } from 'express';
import { createPayment, getPaymentById } from './payment.controller.js';
import { authenticateApiKey } from '../../middleware/auth.js';
import { idempotency } from '../../middleware/idempotency.js';

const router = Router();

// Require both authentication AND idempotency on creation
router.post('/', authenticateApiKey, idempotency(), createPayment);
router.get('/:id', authenticateApiKey, getPaymentById);

export default router;
```

---

### Step 5: Mount Routes in `src/app.js`

```javascript
import paymentRoutes from './modules/payments/payment.routes.js';

// Mount under /v1/payments
app.use('/v1/payments', paymentRoutes);
```

---

## 4. How to Test & Verify

1. **Submit a Payment Creation Request:**
   ```bash
   curl -i -X POST http://localhost:3000/v1/payments \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -H "idempotency-key: order-tx-99901" \
     -d '{
       "amount": 250000,
       "currency": "INR",
       "customerEmail": "customer@example.com"
     }'
   ```
   **Output:** `HTTP/1.1 201 Created` with `status: "CREATED"`.

2. **Verify Database Records:**
   Check using `mongosh`:
   ```bash
   docker exec -it payment_mongo mongosh payment_gateway --eval '
     print("--- PAYMENTS ---");
     db.payments.find().pretty();
     print("--- OUTBOX EVENTS ---");
     db.outboxevents.find().pretty();
   '
   ```
   You will see both the `Payment` document and the `OutboxEvent` document with `status: "PENDING"`.

---

## Checklist Before Phase 5
- [ ] MongoDB session transactions work without replica set errors.
- [ ] Payment document is created in `CREATED` status with Razorpay reference fields ready.
- [ ] Outbox document is created atomically in `PENDING` status.
- [ ] Repeating the request with the same `idempotency-key` returns the cached response safely.

# Phase 7: Webhook Engine (Razorpay Ingestion & Merchant Delivery)

## Objective
Implement an end-to-end webhook architecture with dual security:
1. **Incoming Razorpay Webhook Handler (`POST /v1/webhooks/razorpay`)**: Validates Razorpay's HMAC-SHA256 signature, updates the internal Payment document from `PROCESSING` to `SUCCEEDED` or `FAILED`, updates the Ledger, and enqueues a merchant notification.
2. **Outgoing Merchant Webhook Worker (`src/workers/webhook.worker.js`)**: Signs payloads with the merchant's private `webhookSecret` (`x-signature: sha256=...`) and delivers notifications asynchronously with **BullMQ exponential backoff retries**.

---

## 1. Dual Webhook Architecture

```text
[Razorpay Servers]
       │ 1. Sends payment.captured / payment.failed webhook
       ▼
[Our Gateway: POST /v1/webhooks/razorpay]
       │ 2. Validates 'x-razorpay-signature' with RAZORPAY_WEBHOOK_SECRET
       │ 3. Updates MongoDB Payment status: 'SUCCEEDED' & saves razorpayPaymentId
       │ 4. Records Ledger CREDIT entry
       ▼
[BullMQ "webhook-delivery" Queue]
       │
       ▼
[Outgoing Webhook Worker]
       │ 5. Signs payload with merchant's webhookSecret
       │ 6. Dispatches POST to merchant.webhookUrl with 'x-signature: sha256=...'
       ▼
[Merchant Backend]
       (If Merchant returns 5xx/timeout -> BullMQ automatically retries with backoff)
```

---

## 2. Project Files to Create

```text
backend/src/
├── modules/
│   └── webhooks/
│       ├── webhook.model.js
│       ├── razorpay.webhook.js
│       └── webhook.routes.js
├── queues/
│   └── webhook.queue.js
└── workers/
    └── webhook.worker.js
```

---

## 3. Code Implementation

### Step 1: Webhook Delivery Audit Model (`src/modules/webhooks/webhook.model.js`)

```javascript
import mongoose from 'mongoose';

const webhookDeliverySchema = new mongoose.Schema(
  {
    merchantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Merchant',
      required: true,
      index: true
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true
    },
    eventType: {
      type: String,
      required: true // e.g. "payment.succeeded", "payment.failed"
    },
    payload: {
      type: Object,
      required: true
    },
    webhookUrl: {
      type: String,
      required: true
    },
    responseStatus: {
      type: Number,
      default: null
    },
    responseBody: {
      type: String,
      default: null
    },
    attemptNumber: {
      type: Number,
      default: 1
    },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED'],
      default: 'PENDING',
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const WebhookDelivery = mongoose.model('WebhookDelivery', webhookDeliverySchema);
```

---

### Step 2: BullMQ Webhook Delivery Queue (`src/queues/webhook.queue.js`)

```javascript
import { Queue } from 'bullmq';
import { redisClient } from '../config/redis.js';

export const webhookQueue = new Queue('webhook-delivery', {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 5, // Retry up to 5 times
    backoff: {
      type: 'exponential',
      delay: 3000 // 3s, 6s, 12s, 24s, 48s
    },
    removeOnComplete: 1000,
    removeOnFail: 5000
  }
});
```

---

### Step 3: Incoming Razorpay Webhook Handler (`src/modules/webhooks/razorpay.webhook.js`)

```javascript
import crypto from 'crypto';
import { Payment } from '../payments/payment.model.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { webhookQueue } from '../../queues/webhook.queue.js';

export async function handleRazorpayWebhook(req, res) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  // 1. Verify Razorpay Signature
  const rawBody = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret || '')
    .update(rawBody)
    .digest('hex');

  if (!signature || signature !== expectedSignature) {
    console.error('❌ Invalid Razorpay Webhook Signature!');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const { event, payload } = req.body;
  console.log(`📥 Received verified Razorpay event: ${event}`);

  try {
    if (event === 'payment.captured' || event === 'order.paid') {
      const razorpayPayment = payload.payment?.entity;
      const orderId = razorpayPayment?.order_id || payload.order?.entity?.id;

      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (payment && payment.status !== 'SUCCEEDED') {
        payment.status = 'SUCCEEDED';
        payment.razorpayPaymentId = razorpayPayment?.id || null;
        payment.failureReason = null;
        await payment.save();

        // Record immutable ledger entry
        await LedgerService.recordCredit({
          merchantId: payment.merchantId,
          paymentId: payment._id,
          amount: payment.amount,
          currency: payment.currency
        });

        // Enqueue merchant notification
        await webhookQueue.add('send-webhook', {
          merchantId: payment.merchantId,
          paymentId: payment._id,
          eventType: 'payment.succeeded',
          payload: {
            event: 'payment.succeeded',
            data: {
              paymentId: payment._id,
              razorpayOrderId: payment.razorpayOrderId,
              razorpayPaymentId: payment.razorpayPaymentId,
              amount: payment.amount,
              currency: payment.currency,
              status: 'SUCCEEDED',
              createdAt: payment.createdAt
            }
          }
        });
      }
    } else if (event === 'payment.failed') {
      const razorpayPayment = payload.payment?.entity;
      const orderId = razorpayPayment?.order_id;

      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (payment && payment.status !== 'FAILED') {
        payment.status = 'FAILED';
        payment.failureReason = razorpayPayment?.error_description || 'Payment Failed';
        await payment.save();

        await webhookQueue.add('send-webhook', {
          merchantId: payment.merchantId,
          paymentId: payment._id,
          eventType: 'payment.failed',
          payload: {
            event: 'payment.failed',
            data: {
              paymentId: payment._id,
              status: 'FAILED',
              reason: payment.failureReason
            }
          }
        });
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Error processing Razorpay webhook:', error);
    return res.status(500).json({ error: 'Internal processing error' });
  }
}
```

---

### Step 4: Webhook Routes (`src/modules/webhooks/webhook.routes.js`)

```javascript
import { Router } from 'express';
import { handleRazorpayWebhook } from './razorpay.webhook.js';

const router = Router();

// Razorpay sends webhooks to this endpoint
router.post('/razorpay', handleRazorpayWebhook);

export default router;
```

Mount in `src/app.js`:
```javascript
import webhookRoutes from './modules/webhooks/webhook.routes.js';
app.use('/v1/webhooks', webhookRoutes);
```

---

### Step 5: Merchant Webhook Delivery Worker (`src/workers/webhook.worker.js`)

Dispatches events to the merchant's registered `webhookUrl` with an HMAC signature:

```javascript
import { Worker } from 'bullmq';
import { redisClient } from '../config/redis.js';
import { Merchant } from '../modules/merchants/merchant.model.js';
import { WebhookDelivery } from '../modules/webhooks/webhook.model.js';
import crypto from 'crypto';

export const webhookWorker = new Worker(
  'webhook-delivery',
  async (job) => {
    const { merchantId, paymentId, eventType, payload } = job.data;

    const merchant = await Merchant.findById(merchantId);
    if (!merchant || !merchant.webhookUrl) {
      console.log(`Merchant ${merchantId} has no webhook URL configured. Skipping.`);
      return;
    }

    const payloadString = JSON.stringify(payload);

    // Compute HMAC-SHA256 signature using merchant's private secret
    const signature = crypto
      .createHmac('sha256', merchant.webhookSecret)
      .update(payloadString)
      .digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'x-signature': `sha256=${signature}`,
      'x-event': eventType
    };

    console.log(`🚀 Sending webhook [${eventType}] to ${merchant.webhookUrl} (Attempt ${job.attemptsMade + 1})`);

    let responseStatus = null;
    let responseText = null;

    try {
      const response = await fetch(merchant.webhookUrl, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(5000) // 5s timeout
      });

      responseStatus = response.status;
      responseText = await response.text();

      await WebhookDelivery.create({
        merchantId,
        paymentId,
        eventType,
        payload,
        webhookUrl: merchant.webhookUrl,
        responseStatus,
        responseBody: responseText.slice(0, 500),
        attemptNumber: job.attemptsMade + 1,
        status: response.ok ? 'SUCCESS' : 'FAILED'
      });

      if (!response.ok) {
        throw new Error(`Merchant webhook responded with HTTP ${response.status}`);
      }

      console.log(`✅ Webhook delivered successfully to ${merchant.webhookUrl}`);
    } catch (err) {
      console.error(`❌ Webhook delivery error (Attempt ${job.attemptsMade + 1}):`, err.message);
      throw err; // BullMQ retries automatically with exponential backoff
    }
  },
  {
    connection: redisClient,
    concurrency: 10
  }
);
```

---

## 4. How to Test & Verify

1. **Simulate a Razorpay Webhook:**
   Send a test webhook simulating a captured payment:
   ```bash
   curl -X POST http://localhost:3000/v1/webhooks/razorpay \
     -H "Content-Type: application/json" \
     -H "x-razorpay-signature: CALCULATED_HMAC_OR_TEST_SIGNATURE" \
     -d '{
       "event": "payment.captured",
       "payload": {
         "payment": {
           "entity": {
             "id": "pay_TEST123456",
             "order_id": "order_YOUR_ORDER_ID",
             "amount": 50000,
             "currency": "INR",
             "status": "captured"
           }
         }
       }
     }'
   ```

2. **Verify System Transition:**
   - MongoDB payment status becomes `SUCCEEDED`.
   - Double-entry ledger entry is created.
   - Merchant receives webhook at their registered endpoint with HMAC signature.

---

## Checklist Before Phase 8
- [ ] Incoming Razorpay webhook endpoint verifies signature securely.
- [ ] Captured payments automatically trigger ledger entry & merchant notification.
- [ ] Merchant delivery worker signs payloads with `merchant.webhookSecret`.
- [ ] BullMQ exponential backoff retries transient delivery failures.

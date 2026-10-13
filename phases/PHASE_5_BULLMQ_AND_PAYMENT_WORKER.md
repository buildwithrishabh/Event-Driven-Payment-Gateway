# Phase 5: BullMQ Queues & Razorpay Payment Worker

## Objective

Connect asynchronous distributed processing:

1. Build an **Outbox Relay** that polls `PENDING` outbox events and pushes them into a **BullMQ** queue.
2. Build the **Razorpay Processor** (`src/modules/processor/razorpay.processor.js`) using the official Razorpay SDK to create real upstream orders with the Razorpay API.
3. Build the **Payment Worker** with atomic claim semantics to prevent race conditions when multiple workers run concurrently.

---

## 1. Asynchronous Architecture Flow

```text
[Outbox Relay]
      │ Polls DB every 1.5s for status: 'PENDING'
      ▼
Pushes Job to BullMQ Queue: "payment-process"
      │ Marks outbox event status: 'PROCESSED'
      ▼
[Payment Worker]
      │ 1. Atomic DB Claim: findOneAndUpdate({ status: 'CREATED' } -> 'PROCESSING')
      │ 2. Calls createOrder({ amount, currency, receipt })
      │ 3. Updates MongoDB Payment with razorpayOrderId (e.g. "order_PZ1234...")
      ▼
Ready for Customer Checkout / Payment Capture & Webhook Processing
```

---

## 2. Project Files to Create

```text
backend/src/
├── modules/
│   └── processor/
│       └── razorpay.processor.js
├── queues/
│   └── payment.queue.js
└── workers/
    ├── outbox.relay.js
    └── payment.worker.js
```

---

## 3. Code Implementation

### Step 1: BullMQ Queue Definition (`src/queues/payment.queue.js`)

```javascript
import { Queue } from "bullmq";
import { redisClient } from "../config/redis.js";

export const paymentQueue = new Queue("payment-process", {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000, // Retry in 2s, 4s, 8s
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
```

---

### Step 2: Razorpay Processor Service (`src/modules/processor/razorpay.processor.js`)

This service interacts directly with Razorpay's API:

```javascript
import crypto from "crypto";
import { razorpayClient } from "../../config/razorpay.js";

/**
 * Create an upstream Razorpay Order
 * @param {Object} params
 * @param {number} params.amount - Amount in minor units (paise)
 * @param {string} params.currency - e.g. "INR"
 * @param {string} params.receipt - Internal paymentId reference
 * @param {Object} [params.notes] - Key-value metadata
 */
export async function createOrder({ amount, currency, receipt, notes = {} }) {
  try {
    const order = await razorpayClient.orders.create({
      amount: Math.round(amount),
      currency: currency.toUpperCase(),
      receipt: String(receipt),
      notes,
    });

    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
    };
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    throw new Error(
      `Razorpay Error: ${error.error?.description || error.message}`,
    );
  }
}

/**
 * Fetch payment details from Razorpay
 */
export async function fetchPayment(paymentId) {
  return razorpayClient.payments.fetch(paymentId);
}

/**
 * Fetch all payments for an order
 */
export async function fetchOrderPayments(orderId) {
  return razorpayClient.orders.fetchPayments(orderId);
}

/**
 * Verify Razorpay Payment Signature
 */
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const text = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(text)
    .digest("hex");

  return expectedSignature === signature;
}
```

---

### Step 3: Outbox Relay (`src/workers/outbox.relay.js`)

This background relay polls MongoDB Outbox events and safely enqueues them into BullMQ:

```javascript
import { OutboxEvent } from "../modules/payments/outbox.model.js";
import { paymentQueue } from "../queues/payment.queue.js";

let isRunning = false;

export async function processOutboxBatch() {
  if (isRunning) return;
  isRunning = true;

  try {
    const events = await OutboxEvent.find({ status: "PENDING" })
      .sort({ createdAt: 1 })
      .limit(20);

    for (const event of events) {
      if (event.eventType === "PAYMENT_CREATED") {
        await paymentQueue.add(
          "process-payment",
          {
            paymentId: event.payload.paymentId,
            merchantId: event.payload.merchantId,
            amount: event.payload.amount,
            currency: event.payload.currency,
            customerEmail: event.payload.customerEmail,
          },
          {
            jobId: `pay_${event.payload.paymentId}`, // Deduplication key in BullMQ
          },
        );

        event.status = "PROCESSED";
        await event.save();
      }
    }
  } catch (error) {
    console.error("Outbox Relay polling error:", error);
  } finally {
    isRunning = false;
  }
}

export function startOutboxRelay(intervalMs = 1500) {
  console.log("📬 Outbox Relay started (polling every 1.5s)");
  setInterval(processOutboxBatch, intervalMs);
}
```

---

### Step 4: Payment Worker (`src/workers/payment.worker.js`)

Consumes BullMQ jobs and communicates with Razorpay:

```javascript
import { Worker } from "bullmq";
import { redisClient } from "../config/redis.js";
import { Payment } from "../modules/payments/payment.model.js";
import { createOrder } from "../modules/processor/razorpay.processor.js";
import os from "os";

const workerId = `worker_${os.hostname()}_${process.pid}`;

export const paymentWorker = new Worker(
  "payment-process",
  async (job) => {
    const { paymentId, amount, currency } = job.data;
    console.log(`[${workerId}] Processing payment: ${paymentId}`);

    // 1. ATOMIC CLAIM: Only claim if status is still 'CREATED'
    const payment = await Payment.findOneAndUpdate(
      { _id: paymentId, status: "CREATED" },
      {
        status: "PROCESSING",
        "processingLock.workerId": workerId,
        "processingLock.lockedAt": new Date(),
      },
      { new: true },
    );

    if (!payment) {
      console.log(
        `[${workerId}] Payment ${paymentId} already claimed or processed. Skipping.`,
      );
      return;
    }

    try {
      // 2. Call Razorpay API to generate real upstream Order
      const razorpayOrder = await createOrder({
        amount,
        currency,
        receipt: paymentId,
        notes: {
          gatewayPaymentId: paymentId,
          merchantId: payment.merchantId.toString(),
        },
      });

      // 3. Link Razorpay order ID
      payment.razorpayOrderId = razorpayOrder.orderId;
      payment.failureReason = null;
      payment.processingLock = null;
      await payment.save();

      console.log(
        `[${workerId}] Razorpay Order created: ${razorpayOrder.orderId} for Payment ${paymentId}`,
      );
    } catch (err) {
      console.error(
        `[${workerId}] Razorpay call failed for payment ${paymentId}:`,
        err.message,
      );
      // Release lock for BullMQ retry
      payment.status = "CREATED";
      payment.processingLock = null;
      payment.failureReason = err.message;
      await payment.save();
      throw err; // Re-throw triggers BullMQ exponential backoff
    }
  },
  {
    connection: redisClient,
    concurrency: 5, // Handles up to 5 concurrent payments simultaneously
  },
);

paymentWorker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

paymentWorker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});
```

---

### Step 5: Start Outbox Relay and Worker in `src/app.js`

```javascript
import { startOutboxRelay } from "./workers/outbox.relay.js";
import "./workers/payment.worker.js";

// Inside startServer():
async function startServer() {
  await connectDB();
  startOutboxRelay(1500);

  app.listen(PORT, () => {
    console.log(`🚀 Gateway API running at http://localhost:${PORT}`);
  });
}
```

---

## 4. How to Test & Verify

1. **Submit a Payment:**

   ```bash
   curl -X POST http://localhost:3000/v1/payments \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -H "idempotency-key: order-tx-77701" \
     -d '{
       "amount": 50000,
       "currency": "INR",
       "customerEmail": "alice@example.com"
     }'
   ```

2. **Watch the Server Console Logs:**

   ```text
   [worker_...] Processing payment: 67123...
   [worker_...] Razorpay Order created: order_PZ941b... for Payment 67123...
   ✅ Job pay_67123... completed
   ```

3. **Check Status via Query Endpoint:**
   ```bash
   curl -H "x-api-key: YOUR_API_KEY" http://localhost:3000/v1/payments/RETURNED_PAYMENT_ID
   ```
   **Output:** The payment now contains `razorpayOrderId: "order_PZ941b..."` ready for customer checkout or payment capture!

---

## Checklist Before Phase 6

- [ ] Outbox events are automatically polled and published to BullMQ.
- [ ] BullMQ payment worker consumes jobs with concurrency.
- [ ] Atomic `findOneAndUpdate` lock prevents double worker execution.
- [ ] Razorpay API creates real order and updates payment with `razorpayOrderId`.

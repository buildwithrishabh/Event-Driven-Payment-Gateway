# Phase 8: Reconciliation Worker (Razorpay Sync) & End-to-End Testing

## Objective
Implement system resilience and self-healing:
1. A **Reconciliation Worker** that sweeps and recovers payments stuck in `PROCESSING` status due to worker crashes or missed webhooks by querying the **Razorpay Orders & Payments API**.
2. An end-to-end test suite to verify idempotency, outbox relay, Razorpay processing, ledger integrity, and webhook deliveries.

---

## 1. Why Reconciliation with Razorpay is Essential

In distributed systems, crashes and network partitions happen:
```text
1. Razorpay Order created -> status = 'PROCESSING'
2. Customer completes UPI/card payment on Razorpay -> SUCCESS
3. Network blip drops the incoming webhook before reaching our gateway!
```
Without reconciliation, the customer was charged on Razorpay, but our database says `PROCESSING` forever.
The **Reconciliation Worker** periodically queries Razorpay's `fetchOrderPayments(orderId)` API to synchronize the source of truth and self-heal stuck payments.

---

## 2. Project Files to Create

```text
backend/
├── src/
│   └── workers/
│       └── reconciliation.worker.js
└── test-e2e.js
```

---

## 3. Code Implementation

### Step 1: Reconciliation Worker (`src/workers/reconciliation.worker.js`)

```javascript
import { Payment } from '../modules/payments/payment.model.js';
import { LedgerService } from '../modules/ledger/ledger.service.js';
import { webhookQueue } from '../queues/webhook.queue.js';
import { RazorpayProcessor } from '../modules/processor/razorpay.processor.js';

export async function runReconciliationSweep() {
  console.log('🔍 Running Reconciliation sweep for stuck payments...');

  // Find payments stuck in PROCESSING for more than 3 minutes
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);

  const stuckPayments = await Payment.find({
    status: 'PROCESSING',
    razorpayOrderId: { $ne: null },
    updatedAt: { $lt: threeMinutesAgo }
  });

  if (stuckPayments.length === 0) {
    console.log('✅ No stuck payments found.');
    return;
  }

  console.log(`⚠️ Found ${stuckPayments.length} stuck payments. Checking against Razorpay API...`);

  for (const payment of stuckPayments) {
    try {
      // 1. Query Razorpay API for all payment attempts on this order
      const orderPayments = await RazorpayProcessor.fetchOrderPayments(payment.razorpayOrderId);
      const items = orderPayments.items || [];

      // Look for any captured/successful payment attempt
      const successfulCharge = items.find((p) => p.status === 'captured');

      if (successfulCharge) {
        console.log(`💡 Razorpay verified payment ${successfulCharge.id} is captured! Reconciling to SUCCEEDED.`);
        payment.status = 'SUCCEEDED';
        payment.razorpayPaymentId = successfulCharge.id;
        payment.failureReason = null;
        payment.processingLock = null;
        await payment.save();

        // Record credit in Ledger
        await LedgerService.recordCredit({
          merchantId: payment.merchantId,
          paymentId: payment._id,
          amount: payment.amount,
          currency: payment.currency
        });

        // Dispatch webhook to merchant
        await webhookQueue.add('send-webhook', {
          merchantId: payment.merchantId,
          paymentId: payment._id,
          eventType: 'payment.succeeded',
          payload: {
            event: 'payment.succeeded',
            data: payment
          }
        });
      } else {
        // Check if there are only failed attempts older than 10 minutes
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        if (payment.updatedAt < tenMinutesAgo) {
          console.log(`⌛ Payment ${payment._id} expired without successful capture. Marking as FAILED.`);
          payment.status = 'FAILED';
          payment.failureReason = 'Payment window expired without capture';
          payment.processingLock = null;
          await payment.save();

          await webhookQueue.add('send-webhook', {
            merchantId: payment.merchantId,
            paymentId: payment._id,
            eventType: 'payment.failed',
            payload: {
              event: 'payment.failed',
              data: payment
            }
          });
        }
      }
    } catch (err) {
      console.error(`Failed to reconcile payment ${payment._id}:`, err.message);
    }
  }
}

export function startReconciliationWorker(intervalMs = 60000) {
  console.log('⏱️ Reconciliation worker active (running every 60s)');
  setInterval(runReconciliationSweep, intervalMs);
}
```

---

### Step 2: Start Reconciliation Worker in `src/app.js`

```javascript
import { startReconciliationWorker } from './workers/reconciliation.worker.js';

// Inside startServer():
async function startServer() {
  await connectDB();
  startOutboxRelay(1500);
  startReconciliationWorker(60000); // Check every 60 seconds

  app.listen(PORT, () => {
    console.log(`🚀 Gateway API running at http://localhost:${PORT}`);
  });
}
```

---

### Step 3: End-to-End Test Suite (`backend/test-e2e.js`)

```javascript
import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting End-to-End Test Suite...');

  // 1. Health check
  const healthRes = await fetch(`${BASE_URL}/health`);
  const healthData = await healthRes.json();
  assert.strictEqual(healthData.status, 'OK');
  console.log('✅ Health check passed');

  // 2. Register merchant
  const merchantRes = await fetch(`${BASE_URL}/v1/merchants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Merchant Test ${Date.now()}`,
      email: `test_${Date.now()}@gateway.com`,
      webhookUrl: 'https://webhook.site/test-receiver'
    })
  });
  const merchantData = await merchantRes.json();
  assert.ok(merchantData.apiKey);
  console.log('✅ Merchant registered with API Key');

  // 3. Create payment with Idempotency Key
  const idempotencyKey = `e2e-order-${Date.now()}`;
  const paymentPayload = {
    amount: 15000, // ₹150.00
    currency: 'INR',
    customerEmail: 'buyer@example.com'
  };

  const payRes1 = await fetch(`${BASE_URL}/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': merchantData.apiKey,
      'idempotency-key': idempotencyKey
    },
    body: JSON.stringify(paymentPayload)
  });
  const payData1 = await payRes1.json();
  assert.strictEqual(payRes1.status, 201);
  console.log('✅ Payment initiated (CREATED state)');

  // 4. Test Idempotency: exact same request should replay cached response
  const payRes2 = await fetch(`${BASE_URL}/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': merchantData.apiKey,
      'idempotency-key': idempotencyKey
    },
    body: JSON.stringify(paymentPayload)
  });
  const payData2 = await payRes2.json();
  assert.strictEqual(payRes2.headers.get('x-cache'), 'HIT');
  assert.strictEqual(payData1.paymentId, payData2.paymentId);
  console.log('✅ Idempotency test passed (Response safely replayed)');

  console.log('🎉 ALL END-TO-END TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(console.error);
```

---

## 4. Checklist & Final Verification
- [ ] Reconciliation worker syncs with Razorpay API every 60s.
- [ ] Stuck payments are automatically resolved to `SUCCEEDED` or `FAILED`.
- [ ] Ledger balances update reliably upon self-healing.
- [ ] End-to-end tests complete with zero assertions failed.

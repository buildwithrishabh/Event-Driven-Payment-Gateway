# Phase 6: Immutable Ledger Service

## Objective
Implement financial accounting best practices: an **append-only, immutable ledger**. In financial systems, you must **never** update a balance directly with a field mutation like `balance = balance + amount`. Instead, every money movement creates an immutable entry (`CREDIT` or `DEBIT`). The merchant's balance is computed by aggregating these entries.

---

## 1. Why Append-Only Accounting?

| Wrong Approach (Mutable Balance) | Correct Approach (Immutable Ledger) |
| :--- | :--- |
| `UPDATE merchants SET balance = balance + 50` | `INSERT INTO ledger_entries (type: 'CREDIT', amount: 50)` |
| ❌ Two simultaneous payments cause lost updates | ✅ Concurrent inserts never collide |
| ❌ No historical audit trail of *why* the balance changed | ✅ Complete, tamper-proof history of every transaction |
| ❌ Impossible to reconcile after system crashes | ✅ Exact mathematical recalculation possible at any timestamp |

---

## 2. Project Files to Create

```text
backend/src/
└── modules/
    └── ledger/
        ├── ledger.model.js
        ├── ledger.service.js
        └── ledger.routes.js
```

---

## 3. Code Implementation

### Step 1: Ledger Model (`src/modules/ledger/ledger.model.js`)

```javascript
import mongoose from 'mongoose';

const ledgerEntrySchema = new mongoose.Schema(
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
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 1 // Integer in minor units (e.g. cents)
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'USD'
    },
    description: {
      type: String,
      required: true
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false } // No updatedAt because entries can NEVER be changed!
  }
);

// Prevent updating or deleting ledger records at the Mongoose middleware level
ledgerEntrySchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany'], function () {
  throw new Error('LEDGER_IMMUTABILITY_VIOLATION: Ledger entries cannot be modified or deleted.');
});

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
```

---

### Step 2: Ledger Service (`src/modules/ledger/ledger.service.js`)

```javascript
import mongoose from 'mongoose';
import { LedgerEntry } from './ledger.model.js';

export async function recordCredit({ merchantId, paymentId, amount, currency }) {
  // Check if entry already exists to ensure idempotency
  const existing = await LedgerEntry.findOne({ paymentId, type: 'CREDIT' });
  if (existing) {
    return existing;
  }

  return await LedgerEntry.create({
    merchantId,
    paymentId,
    type: 'CREDIT',
    amount,
    currency,
    description: `Payment collected for ${paymentId}`
  });
}

// Calculate current available balance using MongoDB Aggregation Pipeline
export async function getBalance(merchantId) {
  const pipeline = [
    {
      $match: {
        merchantId: new mongoose.Types.ObjectId(merchantId)
      }
    },
    {
      $group: {
        _id: '$currency',
        totalCredits: {
          $sum: {
            $cond: [{ $eq: ['$type', 'CREDIT'] }, '$amount', 0]
          }
        },
        totalDebits: {
          $sum: {
            $cond: [{ $eq: ['$type', 'DEBIT'] }, '$amount', 0]
          }
        }
      }
    },
    {
      $project: {
        currency: '$_id',
        availableBalance: { $subtract: ['$totalCredits', '$totalDebits'] },
        totalCredits: 1,
        totalDebits: 1,
        _id: 0
      }
    }
  ];

  const results = await LedgerEntry.aggregate(pipeline);
  return results.length > 0 ? results[0] : { currency: 'USD', availableBalance: 0, totalCredits: 0, totalDebits: 0 };
}
```

---

### Step 3: Connect Ledger to `src/workers/payment.worker.js`

In [src/workers/payment.worker.js](file:///d:/Backend/Backend%20Projects/Distributed%20Payment%20Gateway/backend/src/workers/payment.worker.js), import `recordCredit` and invoke it when payment succeeds:

```javascript
import { recordCredit } from '../modules/ledger/ledger.service.js';

// Inside paymentWorker:
if (result.success) {
  payment.status = 'SUCCEEDED';
  payment.processorTransactionId = result.transactionId;
  await payment.save();

  // Create immutable ledger credit entry
  await recordCredit({
    merchantId: payment.merchantId,
    paymentId: payment._id,
    amount: payment.amount,
    currency: payment.currency
  });
  console.log(`📒 Ledger entry recorded for merchant ${payment.merchantId}`);
}
```

---

### Step 4: Ledger Routes (`src/modules/ledger/ledger.routes.js`)

```javascript
import { Router } from 'express';
import { getBalance } from './ledger.service.js';
import { authenticateApiKey } from '../../middleware/auth.js';

const router = Router();

// GET /v1/ledger/balance
router.get('/balance', authenticateApiKey, async (req, res) => {
  try {
    const balance = await getBalance(req.merchant._id);
    return res.json({
      merchantId: req.merchant._id,
      balance
    });
  } catch (error) {
    console.error('Failed to get ledger balance:', error);
    return res.status(500).json({ error: 'Failed to compute balance' });
  }
});

export default router;
```

---

### Step 5: Mount Routes in `src/app.js`

```javascript
import ledgerRoutes from './modules/ledger/ledger.routes.js';

app.use('/v1/ledger', ledgerRoutes);
```

---

## 4. How to Test & Verify

1. **Create Two Payments:**
   - Create Payment 1: amount = 3000 ($30.00)
   - Create Payment 2: amount = 2000 ($20.00)
   Wait 1–2 seconds for the worker to process them.

2. **Query Merchant Balance:**
   ```bash
   curl -i http://localhost:3000/v1/ledger/balance \
     -H "x-api-key: YOUR_API_KEY"
   ```
   **Expected Response:**
   ```json
   {
     "merchantId": "67a9...",
     "balance": {
       "currency": "USD",
       "availableBalance": 5000,
       "totalCredits": 5000,
       "totalDebits": 0
     }
   }
   ```

3. **Verify Ledger Entry Documents:**
   ```bash
   docker exec -it payment_mongo mongosh payment_gateway --eval 'db.ledgerentries.find().pretty()'
   ```
   Notice that two individual immutable documents exist.

---

## Checklist Before Phase 7
- [ ] Ledger entries are append-only (no update or delete queries allowed).
- [ ] Successful payments automatically create a `CREDIT` record.
- [ ] Balances are computed in real-time using MongoDB aggregation.

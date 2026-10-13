# Phase 2: Merchant Service & Authentication

## Objective
Implement merchant registration, secure API key generation (`sec_live_...`), SHA-256 key hashing in the database, and an API Key authentication middleware backed by a 5-minute Redis cache to avoid querying MongoDB on every request.

---

## 1. Project Files to Create

```text
backend/src/
├── middleware/
│   └── auth.js
└── modules/
    └── merchants/
        ├── merchant.model.js
        ├── merchant.controller.js
        └── merchant.routes.js
```

---

## 2. Code Implementation

### Step 1: Merchant Model (`src/modules/merchants/merchant.model.js`)

```javascript
import mongoose from 'mongoose';

const merchantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    apiKeyHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    webhookUrl: {
      type: String,
      default: null
    },
    webhookSecret: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE'
    }
  },
  {
    timestamps: true
  }
);

export const Merchant = mongoose.model('Merchant', merchantSchema);
```

---

### Step 2: Merchant Controller & Key Generator (`src/modules/merchants/merchant.controller.js`)

```javascript
import crypto from 'crypto';
import { Merchant } from './merchant.model.js';

// Helper: Hash raw string using SHA-256
export function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

// POST /v1/merchants
export async function registerMerchant(req, res) {
  try {
    const { name, email, webhookUrl } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    const existing = await Merchant.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Merchant with this email already exists' });
    }

    // Generate raw secure API Key and Webhook Secret
    const rawApiKey = `key_${crypto.randomBytes(24).toString('hex')}`;
    const rawWebhookSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const apiKeyHash = hashKey(rawApiKey);

    const merchant = await Merchant.create({
      name,
      email,
      apiKeyHash,
      webhookUrl: webhookUrl || null,
      webhookSecret: rawWebhookSecret,
      status: 'ACTIVE'
    });

    // IMPORTANT: Return rawApiKey only once during creation!
    return res.status(201).json({
      message: 'Merchant registered successfully. Save your API key now; it will not be shown again.',
      merchantId: merchant._id,
      name: merchant.name,
      email: merchant.email,
      apiKey: rawApiKey,
      webhookSecret: rawWebhookSecret
    });
  } catch (error) {
    console.error('Merchant registration failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// GET /v1/merchants/me (Protected route)
export async function getMerchantProfile(req, res) {
  return res.json({
    merchantId: req.merchant._id,
    name: req.merchant.name,
    email: req.merchant.email,
    webhookUrl: req.merchant.webhookUrl,
    status: req.merchant.status
  });
}
```

---

### Step 3: Merchant Routes (`src/modules/merchants/merchant.routes.js`)

```javascript
import { Router } from 'express';
import { registerMerchant, getMerchantProfile } from './merchant.controller.js';
import { authenticateApiKey } from '../../middleware/auth.js';

const router = Router();

router.post('/', registerMerchant);
router.get('/me', authenticateApiKey, getMerchantProfile);

export default router;
```

---

### Step 4: Auth Middleware with Redis Cache (`src/middleware/auth.js`)

```javascript
import { Merchant } from '../modules/merchants/merchant.model.js';
import { hashKey } from '../modules/merchants/merchant.controller.js';
import { redisClient } from '../config/redis.js';

export async function authenticateApiKey(req, res, next) {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized: Missing x-api-key header' });
  }

  const keyHash = hashKey(apiKey);
  const cacheKey = `auth:merchant:${keyHash}`;

  try {
    // 1. Check Redis Cache first
    const cachedMerchant = await redisClient.get(cacheKey);
    if (cachedMerchant) {
      req.merchant = JSON.parse(cachedMerchant);
      return next();
    }

    // 2. Query MongoDB if cache misses
    const merchant = await Merchant.findOne({ apiKeyHash: keyHash, status: 'ACTIVE' });
    if (!merchant) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or inactive API key' });
    }

    // 3. Cache merchant profile in Redis for 5 minutes (300 seconds)
    const merchantData = {
      _id: merchant._id.toString(),
      name: merchant.name,
      email: merchant.email,
      webhookUrl: merchant.webhookUrl,
      webhookSecret: merchant.webhookSecret,
      status: merchant.status
    };
    await redisClient.set(cacheKey, JSON.stringify(merchantData), 'EX', 300);

    req.merchant = merchantData;
    return next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Authentication internal failure' });
  }
}
```

---

### Step 5: Update `src/app.js` to Mount Merchant Routes

In `src/app.js`, import and mount the routes:
```javascript
import merchantRoutes from './modules/merchants/merchant.routes.js';

// ... other middleware ...
app.use('/v1/merchants', merchantRoutes);
```

---

## 3. How to Test & Verify

1. **Register a new Merchant:**
   ```bash
   curl -X POST http://localhost:3000/v1/merchants \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Acme Store",
       "email": "payments@acme.com",
       "webhookUrl": "https://webhook.site/test"
     }'
   ```
   **Copy the returned `apiKey`.**

2. **Access Protected Route Without Key (Should Fail 401):**
   ```bash
   curl -i http://localhost:3000/v1/merchants/me
   ```

3. **Access Protected Route With Valid API Key (Should Succeed 200):**
   ```bash
   curl -i http://localhost:3000/v1/merchants/me \
     -H "x-api-key: YOUR_COPIED_API_KEY"
   ```

4. **Verify Redis Cache:**
   Run in terminal:
   ```bash
   docker exec -it payment_redis redis-cli KEYS "auth:merchant:*"
   ```
   You should see the cached merchant key present!

---

## Checklist Before Phase 3
- [ ] Merchant can register and receives a generated `apiKey`.
- [ ] MongoDB only stores the hashed key (`apiKeyHash`), never plain text.
- [ ] `authenticateApiKey` protects routes and attaches `req.merchant`.
- [ ] Merchant authentication is cached in Redis for fast repeated requests.

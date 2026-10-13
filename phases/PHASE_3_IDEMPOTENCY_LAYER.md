# Phase 3: The Idempotency Layer

## Objective
Prevent duplicate charges and race conditions caused by network timeouts or client retries. If a client retries a request with the same `Idempotency-Key`, the server must return the original response without executing the payment logic again.

---

## 1. How Idempotency Works

```text
Client Request (with Idempotency-Key: "req_123")
                 |
                 v
       Check Redis Key:
       idempotency:{merchantId}:{key}
       /                           \
(Exists & COMPLETED)           (Does not exist)
       |                              |
Replay cached status code     Set Lock in Redis:
& body immediately.           "PROCESSING" (TTL 120s)
(x-idempotent-replay: true)           |
                              Execute Payment Handler
                                      |
                              Save Response in Redis:
                              { status: 201, body: {...} } (TTL 24h)
```

If another request with the same key arrives while the status is still `"PROCESSING"`, return **HTTP 409 Conflict** ("A request with this idempotency key is currently being processed").

---

## 2. Project Files to Create

```text
backend/src/
└── middleware/
    └── idempotency.js
```

---

## 3. Code Implementation

### Step 1: Idempotency Middleware (`src/middleware/idempotency.js`)

```javascript
import { redisClient } from '../config/redis.js';

export function idempotency(options = { ttlSeconds: 86400 }) { // Default cache 24h
  return async (req, res, next) => {
    // Only apply idempotency to mutating requests
    if (req.method !== 'POST' && req.method !== 'PATCH') {
      return next();
    }

    const idempotencyKey = req.header('idempotency-key');
    if (!idempotencyKey) {
      return res.status(400).json({ error: 'Missing required Idempotency-Key header' });
    }

    if (!req.merchant || !req.merchant._id) {
      return res.status(500).json({ error: 'Idempotency middleware must run AFTER authenticateApiKey' });
    }

    const redisKey = `idempotency:${req.merchant._id}:${idempotencyKey}`;

    try {
      // 1. Attempt to acquire an atomic lock using Redis SET NX
      // Value is "PROCESSING", lock expires in 120s to avoid deadlocks on crashes
      const lockAcquired = await redisClient.set(redisKey, JSON.stringify({ state: 'PROCESSING' }), 'EX', 120, 'NX');

      if (!lockAcquired) {
        // Key already exists! Check whether it is still PROCESSING or already COMPLETED
        const rawCached = await redisClient.get(redisKey);
        if (!rawCached) {
          return res.status(500).json({ error: 'Idempotency lookup error' });
        }

        const cached = JSON.parse(rawCached);

        if (cached.state === 'PROCESSING') {
          return res.status(409).json({
            error: 'Conflict: A request with this Idempotency-Key is currently in-flight'
          });
        }

        if (cached.state === 'COMPLETED') {
          // Replay original cached response!
          res.setHeader('x-idempotent-replay', 'true');
          return res.status(cached.statusCode).json(cached.body);
        }
      }

      // 2. Intercept response to store result upon completion
      const originalJson = res.json.bind(res);

      res.json = (body) => {
        // Cache the successful/failed response payload
        const record = {
          state: 'COMPLETED',
          statusCode: res.statusCode,
          body
        };

        // Persist completed record for 24 hours
        redisClient.set(redisKey, JSON.stringify(record), 'EX', options.ttlSeconds).catch((err) => {
          console.error('Failed to save idempotency response to Redis:', err);
        });

        return originalJson(body);
      };

      return next();
    } catch (error) {
      console.error('Idempotency error:', error);
      return res.status(500).json({ error: 'Idempotency verification error' });
    }
  };
}
```

---

## 4. How to Test & Verify

Let's test this with a temporary test route in `src/app.js`:

```javascript
import { authenticateApiKey } from './middleware/auth.js';
import { idempotency } from './middleware/idempotency.js';

app.post('/v1/test-idempotency', authenticateApiKey, idempotency(), (req, res) => {
  res.status(201).json({
    message: 'Operation succeeded',
    generatedId: Math.floor(Math.random() * 100000)
  });
});
```

### Verification Steps:

1. **First Request:**
   ```bash
   curl -i -X POST http://localhost:3000/v1/test-idempotency \
     -H "x-api-key: YOUR_API_KEY" \
     -H "idempotency-key: test-key-101" \
     -H "Content-Type: application/json"
   ```
   **Output:** Returns `HTTP/1.1 201 Created` with a `generatedId` (e.g. `48291`).

2. **Second Request (with exact same key):**
   ```bash
   curl -i -X POST http://localhost:3000/v1/test-idempotency \
     -H "x-api-key: YOUR_API_KEY" \
     -H "idempotency-key: test-key-101" \
     -H "Content-Type: application/json"
   ```
   **Output:**
   - Header: `x-idempotent-replay: true`
   - Body: Returns the exact same `generatedId` (`48291`), proving the handler did **not** re-execute!

3. **Missing Header:**
   ```bash
   curl -i -X POST http://localhost:3000/v1/test-idempotency \
     -H "x-api-key: YOUR_API_KEY"
   ```
   **Output:** Returns `400 Bad Request` ("Missing required Idempotency-Key header").

---

## Checklist Before Phase 4
- [ ] Requests without `Idempotency-Key` are rejected with HTTP 400.
- [ ] Retrying with the same key returns the cached response with `x-idempotent-replay: true`.
- [ ] Concurrent requests with the same key receive HTTP 409 Conflict.

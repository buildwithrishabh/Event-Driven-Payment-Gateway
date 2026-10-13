# Phase 1: Setup & Infrastructure

## Objective
Set up the Node.js JavaScript environment, configure Docker Compose with a single-node MongoDB replica set (required for multi-document ACID transactions) and Redis, initialize the Razorpay SDK client, and establish database & cache connections with a running Express server.

---

## 1. Project Files to Create

```text
backend/
├── docker-compose.yml
├── .env
├── .env.example
├── package.json
└── src/
    ├── app.js
    └── config/
        ├── db.js
        ├── redis.js
        └── razorpay.js
```

---

## 2. Configuration & Code

### Step 1: `package.json`
Place this in `backend/package.json`. Notice `"type": "module"` allows modern ES Module syntax (`import`/`export`), and `"razorpay"` is included as the real upstream payment processor SDK.

```json
{
  "name": "distributed-payment-gateway",
  "version": "1.0.0",
  "description": "Distributed Payment Gateway backend project in Node.js powered by Razorpay",
  "main": "src/app.js",
  "type": "module",
  "scripts": {
    "start": "node src/app.js",
    "dev": "node --watch src/app.js"
  },
  "dependencies": {
    "bullmq": "^5.41.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "helmet": "^8.0.0",
    "ioredis": "^5.4.2",
    "mongoose": "^8.9.5",
    "razorpay": "^2.9.8",
    "uuid": "^11.0.5"
  }
}
```

---

### Step 2: `docker-compose.yml`
Place this in `backend/docker-compose.yml`.
MongoDB must run as a replica set (`rs0`) so we can use `session.startTransaction()` for ACID multi-document writes.

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: payment_mongo
    command: ["--replSet", "rs0", "--bind_ip_all"]
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  mongo-init:
    image: mongo:6.0
    depends_on:
      - mongodb
    entrypoint: [ "bash", "-c", "sleep 3 && mongosh --host mongodb:27017 --eval 'rs.initiate()'" ]

  redis:
    image: redis:7-alpine
    container_name: payment_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  mongo_data:
  redis_data:
```

---

### Step 3: `.env` and `.env.example`
Place this in `backend/.env`:

```env
PORT=3000
NODE_ENV=development

# MongoDB Connection String (directConnection=true is required for local replica sets)
MONGODB_URI=mongodb://127.0.0.1:27017/payment_gateway?directConnection=true

# Redis Connection
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Razorpay API Credentials (Get from dashboard.razorpay.com -> Settings -> API Keys)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
```

---

### Step 4: MongoDB Connection Helper (`src/config/db.js`)

```javascript
import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/payment_gateway?directConnection=true';
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB Replica Set');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}
```

---

### Step 5: Redis Client Helper (`src/config/redis.js`)

```javascript
import Redis from 'ioredis';

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

export const redisClient = new Redis({
  host: redisHost,
  port: redisPort,
  maxRetriesPerRequest: null // Required by BullMQ
});

redisClient.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});
```

---

### Step 6: Razorpay Client Helper (`src/config/razorpay.js`)

```javascript
import Razorpay from 'razorpay';

export const razorpayClient = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
});
```

---

### Step 7: Express Server Entrypoint (`src/app.js`)

```javascript
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { redisClient } from './config/redis.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Parsing middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health Check Endpoint
app.get('/health', async (req, res) => {
  const redisStatus = redisClient.status === 'ready' ? 'OK' : 'DEGRADED';
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    services: {
      api: 'UP',
      redis: redisStatus,
      processor: 'Razorpay'
    }
  });
});

async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Gateway API running at http://localhost:${PORT}`);
  });
}

startServer();
```

---

## 3. How to Run & Verify

1. **Start Docker Containers:**
   ```bash
   cd backend
   docker-compose up -d
   ```
   *(Wait 5 seconds for `mongo-init` to run `rs.initiate()`)*

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Run Development Server:**
   ```bash
   npm run dev
   ```

4. **Verify Health Endpoint:**
   ```bash
   curl -i http://localhost:3000/health
   ```
   **Expected Response:**
   ```json
   {
     "status": "OK",
     "timestamp": "2026-10-10T11:45:00.000Z",
     "services": {
       "api": "UP",
       "redis": "OK",
       "processor": "Razorpay"
     }
   }
   ```

---

## Checklist Before Phase 2
- [ ] MongoDB container is running and replica set `rs0` is initialized.
- [ ] Redis container is running on port 6379.
- [ ] Razorpay SDK installed (`razorpay`) and `src/config/razorpay.js` configured with Test Keys.
- [ ] `npm run dev` boots without connection errors.
- [ ] `GET /health` returns HTTP 200 with Redis `OK`.

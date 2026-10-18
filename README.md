# ⚡ Event-Driven Payment Gateway & Ledger Engine

> An asynchronous, fault-tolerant payment gateway, customer checkout platform, append-only financial ledger, and refund engine. Built with **Node.js (Express 5)**, **MongoDB (Replica Set)**, **Redis**, **BullMQ**, **Razorpay**, and a **React 18 + Tailwind CSS** merchant dashboard.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Prerequisites & Environment Variables](#-prerequisites--environment-variables)
  - [Backend Environment Variables](#backend-environment-variables)
  - [Frontend Environment Variables](#frontend-environment-variables)
- [Step-by-Step Setup & Running](#-step-by-step-setup--running)
  - [1. Infrastructure (MongoDB & Redis)](#1-infrastructure-mongodb--redis)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
- [API Reference](#-api-reference)
  - [Authentication](#authentication)
  - [Idempotency](#idempotency)
  - [Health Check](#health-check)
  - [Merchant Endpoints](#merchant-endpoints)
  - [Payment Endpoints](#payment-endpoints)
  - [Checkout Endpoints (Public)](#checkout-endpoints-public)
  - [Ledger Endpoints](#ledger-endpoints)
  - [Refund Endpoints](#refund-endpoints)
  - [Inbound Webhook Endpoint](#inbound-webhook-endpoint)
- [Core Architectural Mechanisms](#-core-architectural-mechanisms)
- [Missing & Incomplete Functionality](#-missing--incomplete-functionality)

---

## 💡 Overview

In financial software, standard synchronous operations and in-place database balance updates (`balance = balance + amount`) lead to severe vulnerabilities: double charges upon network retries, race conditions during high concurrency, and data corruption when services crash mid-request.

The **Event-Driven Payment Gateway & Ledger Engine** solves these problems using distributed systems patterns:
1. **Sub-50ms API Response Times**: Ingestion endpoints validate requests and write to database outbox tables before offloading heavy processor network calls to background queues.
2. **Two-Tier Idempotency**: Prevents double charges through Redis-backed distributed locks and request-response replaying.
3. **Dual-Write Prevention (Transactional Outbox Pattern)**: Persists domain entities and outbox events in the same database write, relayed asynchronously to BullMQ workers.
4. **Append-Only Double-Entry Ledger**: Balances are calculated dynamically by aggregating immutable credit and debit journal entries, with updates and deletions blocked at the database driver level.
5. **Self-Healing Reconciliation**: A scheduled background worker checks for orphaned in-flight payments directly with upstream Razorpay APIs and reconciles them automatically.
6. **Outbound Webhook Dispatcher**: Delivers signed HMAC-SHA256 notifications to merchants with exponential backoff retries.

---

## 🌟 Key Features

- **Merchant Onboarding**: Dynamic API key generation (`key_<hex>`) and webhook secret generation (`whsec_<hex>`), stored using SHA-256 hashes with Redis caching.
- **Idempotent Ingestion**: Redis-based `Idempotency-Key` tracking ensures safe retries with zero duplicate payments or refunds.
- **Transactional Outbox Worker**: Polls pending events (`PAYMENT_CREATED`, `REFUND_CREATED`) and enqueues jobs into BullMQ queues with deduplication keys.
- **Razorpay Integration**: Creates upstream orders, processes refunds, and verifies cryptographic webhook and checkout signatures.
- **Double-Entry Financial Ledger**: Strictly append-only collection where each entry is an immutable debit or credit; updates and deletions are blocked by schema hooks.
- **Asynchronous Refund Engine**: Validates refundable balance, atomically reserves amounts, executes upstream refunds, records ledger debits, and handles automatic rollbacks if terminal failures occur.
- **Reconciliation Engine**: Identifies payments stalled in `PROCESSING` status for over 3 minutes and synchronizes status with Razorpay.
- **Merchant Management Dashboard**: Interactive React dashboard for monitoring balance, managing payments, issuing refunds, reviewing immutable ledger audits, and inspecting API logs.
- **Hosted Customer Checkout**: Public checkout portal allowing end customers to pay via Razorpay checkout or run simulated test payments.

---

## 🛠 Tech Stack

### Backend
- **Runtime**: [Node.js](https://nodejs.org/) (ES Modules, `node --watch`)
- **Web Framework**: [Express 5](https://expressjs.com/) (`v5.3.0`)
- **Primary Database**: [MongoDB](https://www.mongodb.com/) via [Mongoose](https://mongoosejs.com/) (`v9.11.1`)
- **In-Memory Store & Cache**: [Redis](https://redis.io/) via [ioredis](https://github.com/redis/ioredis) (`v6.0.0`)
- **Distributed Queues**: [BullMQ](https://bullmq.io/) (`v6.3.12`)
- **Payment Processing**: [Razorpay Node SDK](https://razorpay.com/docs/api/) (`v2.9.8`)
- **Logging & Security**: [Winston](https://github.com/winstonjs/winston), [Morgan](https://github.com/expressjs/morgan), [Helmet](https://helmetjs.github.io/), [CORS](https://github.com/expressjs/cors)

### Frontend
- **Framework & Tooling**: [React 18](https://react.dev/), [Vite 5](https://vitejs.dev/)
- **Routing**: [React Router DOM 6](https://reactrouter.com/)
- **Styling**: [Tailwind CSS 3](https://tailwindcss.com/), [PostCSS](https://postcss.org/)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 📂 Project Directory Structure

```text
Event-Driven Payment Gateway & Ledger Engine/
├── ARCHITECTURE.md                  # Comprehensive architectural specification
├── README.md                        # Project documentation and setup guide
├── backend/
│   ├── .env.example                 # Backend environment variable template
│   ├── docker-compose.yml           # Docker compose template (currently empty)
│   ├── package.json                 # Backend scripts and dependencies
│   └── src/
│       ├── app.js                   # Application entrypoint & HTTP server
│       ├── config/
│       │   ├── db.js                # MongoDB connection handler
│       │   ├── logger.js            # Winston structured logger
│       │   ├── razorpay.js          # Razorpay SDK client initialization
│       │   └── redis.js             # ioredis client configuration
│       ├── middleware/
│       │   ├── auth.js              # x-api-key authentication with Redis caching
│       │   ├── idempotency.js       # Atomic locking & response replay middleware
│       │   └── morgan.middleware.js # Express HTTP access logger
│       ├── modules/
│       │   ├── checkout/            # Public customer checkout session & verification
│       │   │   ├── checkout.controller.js
│       │   │   └── checkout.routes.js
│       │   ├── ledger/              # Double-entry ledger & balance aggregation
│       │   │   ├── ledger.model.js
│       │   │   ├── ledger.routes.js
│       │   │   └── ledger.service.js
│       │   ├── merchants/           # Merchant registration & profile lookup
│       │   │   ├── merchant.controller.js
│       │   │   ├── merchant.model.js
│       │   │   └── merchant.routes.js
│       │   ├── payments/            # Payment ingestion, queries & verification
│       │   │   ├── outbox.model.js
│       │   │   ├── payment.controller.js
│       │   │   ├── payment.model.js
│       │   │   └── payment.routes.js
│       │   ├── processors/          # Upstream Razorpay processor integration
│       │   │   └── razorpay.processor.js
│       │   ├── refunds/             # Refund state management & routes
│       │   │   ├── refund.controller.js
│       │   │   ├── refund.model.js
│       │   │   ├── refund.routes.js
│       │   │   └── refund.service.js
│       │   └── webhooks/            # Inbound Razorpay webhook handling
│       │       ├── razorpay.webhook.js
│       │       ├── webhook.model.js
│       │       └── webhook.routes.js
│       ├── queues/                  # BullMQ queue declarations
│       │   ├── payment.queue.js
│       │   ├── refund.queue.js
│       │   └── webhook.queue.js
│       └── workers/                 # Background workers & scheduled relays
│           ├── outbox.relay.js      # Polling outbox table -> queues
│           ├── payment.worker.js    # Consumes payments & creates Razorpay orders
│           ├── reconciliation.worker.js # Sweeps stuck payments
│           ├── refund.worker.js     # Consumes refunds & calls Razorpay API
│           └── webhook.worker.js    # Dispatches signed webhooks to merchants
└── frontend/
    ├── .env.example                 # Frontend environment variable template
    ├── package.json                 # Frontend dependencies & scripts
    ├── index.html                   # Single Page App root HTML
    ├── tailwind.config.js           # Design system configuration
    ├── vite.config.js               # Vite bundler configuration
    └── src/
        ├── App.jsx                  # Main application routes & shell
        ├── main.jsx                 # React root bootstrap
        ├── context/                 # AuthContext (API key) & ToastContext
        ├── lib/
        │   ├── api.js               # Typed HTTP client for all backend endpoints
        │   └── format.js            # Minor unit (paise) converters & formatters
        └── pages/                   # Console screens (Dashboard, Payments, Ledger, etc.)
```

---

## ⚙️ Prerequisites & Environment Variables

### Prerequisites
- **Node.js**: v18.x or v20.x+
- **MongoDB**: v6.x or v7.x (A replica set is **required** because Mongoose sessions and transactions require replication enabled)
- **Redis**: v6.x or v7.x+
- **Razorpay Account**: API Key ID and Secret from your Razorpay Dashboard (Test mode works out of the box)

### Backend Environment Variables
Create a file at `backend/.env` based on `backend/.env.example`:

```env
PORT=3000
NODE_ENV=development

# MongoDB Connection String
# (directConnection=true is required for local standalone replica sets)
MONGODB_URI=mongodb://127.0.0.1:27017/payment_gateway?directConnection=true

# Redis Connection
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Razorpay API Credentials
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
```

### Frontend Environment Variables
Create a file at `frontend/.env` based on `frontend/.env.example`:

```env
# Backend server URL (no trailing slash, no /v1)
VITE_API_BASE_URL=http://localhost:3000
```

---

## 🚀 Step-by-Step Setup & Running

### 1. Infrastructure (MongoDB & Redis)

#### Option A: Local Native Services
- Ensure **Redis** is listening on `127.0.0.1:6379`.
- Ensure **MongoDB** is running as a single-node replica set. If starting mongod locally:
  ```bash
  mongod --replSet rs0 --dbpath /data/db
  ```
  Then run `rs.initiate()` once in the `mongosh` shell.

#### Option B: Docker Containers
```bash
# Start Redis container
docker run -d --name redis-gateway -p 6379:6379 redis:7-alpine

# Start MongoDB replica set container
docker run -d --name mongo-gateway -p 27017:27017 mongo:7.0 --replSet rs0
# Initialize the replica set inside the container:
docker exec -it mongo-gateway mongosh --eval "rs.initiate()"
```

---

### 2. Backend Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Edit .env with your real or test Razorpay credentials

# 4. Start in development mode (with native hot-reload)
npm run dev

# 5. Or start in standard production mode
npm start
```

When started, the backend:
- Connects to MongoDB via [connectDB](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/config/db.js).
- Connects to Redis via [redisClient](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/config/redis.js).
- Starts the outbox polling relay every 1500ms via [startOutboxRelay](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/outbox.relay.js).
- Starts the reconciliation worker every 60s via [startReconciliationWorker](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/reconciliation.worker.js).
- Starts listening on `http://localhost:3000`.

---

### 3. Frontend Setup

```bash
# 1. Open a new terminal and navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env

# 4. Start Vite development server
npm run dev
```

Open `http://localhost:5173` in your browser.
1. Head to `/connect` to generate a new merchant API key or paste an existing key.
2. The key will be stored in your browser's `localStorage` and sent automatically with every protected request.

---

## 📡 API Reference

> **Note on Money Representation**: All amounts are represented as positive **integers in minor units** (e.g., `10000` = ₹100.00). The minimum payment amount accepted is `100` (₹1.00).

### Authentication
Protected routes require the `x-api-key` header containing the merchant's private API key:
```http
x-api-key: key_7b4c6e910283...
```
Requests without a valid key return `401 Unauthorized`.

### Idempotency
All mutating payment and refund creation requests (`POST /v1/payments`, `POST /v1/refunds`) require an idempotency key header:
```http
Idempotency-Key: req_abc123xyz
# or
x-idempotency-key: req_abc123xyz
```
Duplicate requests return the previously cached response with the HTTP header:
```http
x-idempotent-replay: true
```

---

### Health Check

#### `GET /health`
Verifies API server liveness and Redis connectivity.
- **Access**: Public
- **Response `200 OK`**:
  ```json
  {
    "status": "OK",
    "timeStamp": "2026-10-18T08:00:00.000Z",
    "service": {
      "api": "UP",
      "redis": "OK"
    }
  }
  ```

---

### Merchant Endpoints

#### `POST /v1/merchants`
Registers a new merchant. Returns the raw API key and webhook secret **only once**.
- **Access**: Public
- **Request Body**:
  ```json
  {
    "name": "Acme Retailers",
    "email": "finance@acme.com",
    "webhookUrl": "https://acme.com/webhooks/gateway"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "message": "Merchant registered successfully. Save your API key now; it will not be shown again.",
    "merchantId": "651a2b3c4d5e6f7a8b9c0d1e",
    "name": "Acme Retailers",
    "email": "finance@acme.com",
    "apiKey": "key_0192837465abc123def456...",
    "webhookSecret": "whsec_789xyz456rst123..."
  }
  ```

#### `GET /v1/merchants/me`
Retrieves the authenticated merchant's profile.
- **Access**: Protected (`x-api-key`)
- **Response `200 OK`**:
  ```json
  {
    "merchantId": "651a2b3c4d5e6f7a8b9c0d1e",
    "name": "Acme Retailers",
    "email": "finance@acme.com",
    "webhookUrl": "https://acme.com/webhooks/gateway",
    "status": "ACTIVE"
  }
  ```

---

### Payment Endpoints

#### `POST /v1/payments`
Creates a payment record in `CREATED` status and writes an outbox event.
- **Access**: Protected (`x-api-key` + `Idempotency-Key`)
- **Request Body**:
  ```json
  {
    "amount": 25000,
    "currency": "INR",
    "customerEmail": "customer@example.com",
    "customerPhone": "9876543210"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "paymentId": "651a2c3d4e5f6a7b8c9d0e1f",
    "merchantId": "651a2b3c4d5e6f7a8b9c0d1e",
    "amount": 25000,
    "currency": "INR",
    "status": "CREATED",
    "createdAt": "2026-10-18T08:05:00.000Z"
  }
  ```

#### `GET /v1/payments`
Lists payments belonging to the authenticated merchant with pagination and filtering.
- **Access**: Protected (`x-api-key`)
- **Query Parameters**:
  - `status` (optional): `CREATED`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`
  - `search` (optional): Filters by `customerEmail` (regex match)
  - `page` (optional, default `1`): Page number
  - `limit` (optional, default `20`, max `50`): Results per page
- **Response `200 OK`**:
  ```json
  {
    "data": [
      {
        "_id": "651a2c3d4e5f6a7b8c9d0e1f",
        "merchantId": "651a2b3c4d5e6f7a8b9c0d1e",
        "amount": 25000,
        "currency": "INR",
        "status": "SUCCEEDED",
        "customerEmail": "customer@example.com",
        "razorpayOrderId": "order_NXyZ123456",
        "razorpayPaymentId": "pay_NXyZ789012",
        "refundedAmount": 0,
        "refundStatus": "NONE",
        "createdAt": "2026-10-18T08:05:00.000Z",
        "updatedAt": "2026-10-18T08:06:12.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
  ```

#### `GET /v1/payments/:id`
Retrieves complete details for a single payment.
- **Access**: Protected (`x-api-key`)
- **Response `200 OK`**: Returns the complete Payment document.

#### `POST /v1/payments/verify`
Directly verifies payment signature and updates payment status to `SUCCEEDED`.
- **Access**: Protected (`x-api-key`)
- **Request Body**:
  ```json
  {
    "paymentId": "651a2c3d4e5f6a7b8c9d0e1f",
    "razorpayOrderId": "order_NXyZ123456",
    "razorpayPaymentId": "pay_NXyZ789012",
    "razorpaySignature": "9b12a8b3..."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Payment verified and recorded successfully",
    "paymentId": "651a2c3d4e5f6a7b8c9d0e1f",
    "status": "SUCCEEDED"
  }
  ```

---

### Checkout Endpoints (Public)

#### `GET /v1/checkout/:id`
Fetches sanitized payment metadata to render the customer-facing checkout UI.
- **Access**: Public
- **Response `200 OK`**:
  ```json
  {
    "paymentId": "651a2c3d4e5f6a7b8c9d0e1f",
    "amount": 25000,
    "currency": "INR",
    "status": "PROCESSING",
    "customerEmail": "customer@example.com",
    "customerPhone": "9876543210",
    "razorpayOrderId": "order_NXyZ123456",
    "razorpayKeyId": "rzp_test_your_key_id",
    "merchant": {
      "name": "Acme Retailers",
      "email": "finance@acme.com"
    }
  }
  ```

#### `POST /v1/checkout/verify`
Submits checkout credentials upon payment completion from the browser.
- **Access**: Public
- **Request Body**: Same as `/v1/payments/verify`.
- **Response `200 OK`**: Confirms signature validity and credit to ledger.

---

### Ledger Endpoints

#### `GET /v1/ledger/balance`
Calculates available balance in real time using a MongoDB aggregation pipeline over all credit and debit entries.
- **Access**: Protected (`x-api-key`)
- **Response `200 OK`**:
  ```json
  {
    "merchantId": "651a2b3c4d5e6f7a8b9c0d1e",
    "balance": {
      "currency": "INR",
      "availableBalance": 20000,
      "totalCredits": 25000,
      "totalDebits": 5000
    }
  }
  ```

#### `GET /v1/ledger/entries`
Retrieves paginated, immutable journal audit records.
- **Access**: Protected (`x-api-key`)
- **Query Parameters**: `page` (default 1), `limit` (default 20, max 50)
- **Response `200 OK`**:
  ```json
  {
    "data": [
      {
        "_id": "651a2e3f4a5b6c7d8e9f0a1b",
        "merchantId": "651a2b3c4d5e6f7a8b9c0d1e",
        "paymentId": {
          "_id": "651a2c3d4e5f6a7b8c9d0e1f",
          "customerEmail": "customer@example.com",
          "status": "SUCCEEDED"
        },
        "refundId": null,
        "type": "CREDIT",
        "amount": 25000,
        "currency": "INR",
        "description": "Payment collected for 651a2c3d4e5f6a7b8c9d0e1f",
        "createdAt": "2026-10-18T08:06:12.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
  ```

---

### Refund Endpoints

#### `POST /v1/refunds`
Initiates a partial or full refund for a `SUCCEEDED` payment.
- **Access**: Protected (`x-api-key` + `Idempotency-Key`)
- **Request Body**:
  ```json
  {
    "paymentId": "651a2c3d4e5f6a7b8c9d0e1f",
    "amount": 5000,
    "reason": "Customer returned merchandise"
  }
  ```
  *(Note: Omitting `amount` defaults to the remaining unrefunded balance).*
- **Response `202 Accepted`**:
  ```json
  {
    "message": "Refund initiated successfully",
    "refund": {
      "_id": "651a2f4a5b6c7d8e9f0a1b2c",
      "merchantId": "651a2b3c4d5e6f7a8b9c0d1e",
      "paymentId": "651a2c3d4e5f6a7b8c9d0e1f",
      "processorPaymentId": "pay_NXyZ789012",
      "amount": 5000,
      "currency": "INR",
      "reason": "Customer returned merchandise",
      "status": "PENDING"
    }
  }
  ```

#### `GET /v1/refunds`
Lists refunds for the authenticated merchant.
- **Access**: Protected (`x-api-key`)
- **Query Parameters**: `status`, `search`, `page`, `limit`
- **Response `200 OK`**: Paginated list of refunds.

#### `GET /v1/refunds/:id`
Retrieves a refund by its MongoDB ID or Razorpay refund ID.
- **Access**: Protected (`x-api-key`)

#### `GET /v1/refunds/payment/:paymentId`
Lists all refunds issued against a specific payment.
- **Access**: Protected (`x-api-key`)

---

### Inbound Webhook Endpoint

#### `POST /v1/webhooks/razorpay`
Inbound webhook receiver for Razorpay events (`payment.captured`, `order.paid`, `payment.failed`).
- **Access**: Public (Requires valid `x-razorpay-signature` HTTP header)
- **Signature Check**: Computes `crypto.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(req.rawBody).digest("hex")`.
- **Handling**: Updates payment document, records ledger entry if captured, and enqueues merchant webhook dispatch.
- **Response `200 OK`**: `{ "status": "ok" }`.

---

## 🏗 Core Architectural Mechanisms

| Mechanism | Implementation Location | Description |
| :--- | :--- | :--- |
| **API Authentication** | [auth.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/middleware/auth.js) | SHA-256 hashes key; checks Redis cache (`auth:merchant:<hash>`, TTL 300s); queries MongoDB on miss. |
| **Distributed Idempotency** | [idempotency.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/middleware/idempotency.js) | Redis `SET NX` key with 120s TTL lock; on completion, caches response status & body for 24h. Returns 409 if in-flight. |
| **Transactional Outbox** | [outbox.model.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/modules/payments/outbox.model.js), [outbox.relay.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/outbox.relay.js) | Decouples HTTP handlers from external services; polls pending events every 1.5s and enqueues into BullMQ. |
| **Worker Concurrency & Locking** | [payment.worker.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/payment.worker.js) | Atomic `findOneAndUpdate` sets `status: "PROCESSING"` and `processingLock: { workerId, lockedAt }`. |
| **Ledger Immutability** | [ledger.model.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/modules/ledger/ledger.model.js) | Mongoose pre-hook blocks `updateOne`, `deleteMany`, etc., throwing `LEDGER_IMMUTABILITY_VIOLATION`. |
| **Ledger Balance Calculation** | [ledger.service.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/modules/ledger/ledger.service.js) | MongoDB aggregation pipeline calculates `availableBalance = totalCredits - totalDebits`. |
| **Refund Compensation** | [refund.worker.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/refund.worker.js) | Pre-reserves refunded amount; on permanent upstream failure after 5 attempts, decrements `refundedAmount` automatically. |
| **Self-Healing Reconciliation** | [reconciliation.worker.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/reconciliation.worker.js) | Runs every 60s; checks payments in `PROCESSING` status > 3 min against Razorpay and heals orphaned payments. |
| **Outbound Webhooks** | [webhook.worker.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/webhook.worker.js) | Signs payload with merchant's `webhookSecret` (HMAC-SHA256) in `x-signature` header; retries up to 5 times. |

---

## ⚠️ Missing & Incomplete Functionality

To maintain honest documentation, the following items in the current repository are highlighted:

1. **Docker Compose File is Empty**: `backend/docker-compose.yml` is an empty file (0 bytes). Developers must start MongoDB and Redis manually or via custom container commands.
2. **Automated Test Suite**: `backend/package.json` specifies `"test": "echo \"Error: no test specified\" && exit 1"`. There are currently no automated unit or integration test suites implemented.
3. **Multi-Currency Ledger Balance Grouping**: The ledger stores currency per entry, but [getBalance](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/modules/ledger/ledger.service.js#L55-L92) returns `results[0]` (the first currency group encountered). A merchant transacting in multiple currencies will only see the first grouped currency returned.
4. **Hardcoded Fallback DNS**: [app.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/app.js#L2-L3) explicitly overrides DNS servers to `["8.8.8.8", "1.1.1.1"]` to prevent resolution failures in some local environments.
5. **No Key Revocation or Rotation UI**: API keys and webhook secrets can be generated once upon registration, but there is no endpoint currently implemented to rotate or revoke them.

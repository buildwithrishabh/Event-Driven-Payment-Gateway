# ⚡ Event-Driven Payment Gateway & Ledger Engine

[![Node.js](https://img.shields.io/badge/Node.js-v20+-68a063?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Replica_Set-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-v6-FF4438?style=flat-square)](https://bullmq.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)

> **A production-grade, distributed fintech engine that guarantees zero double-charges, zero lost events, and mathematically immutable financial balances.**  
> Built with Node.js (Express 5), MongoDB Replica Sets, Redis, BullMQ, Razorpay SDK, and a React 18 Merchant Dashboard.

---

## 🎯 The Core Problem & Why This Exists

In typical web apps, handling payments with naive CRUD operations (`merchant.balance += amount` or calling third-party payment APIs directly inside an HTTP route) leads to catastrophic financial failures:

```
❌ The 4 Deadly Traps of Naive Payment Systems:
1. Double Charging: A customer clicks "Pay" twice or a network retry happens → 2 charges created.
2. The Dual-Write Trap: Database write succeeds, but Redis/Kafka publish fails → payment lost in limbo.
3. Balance Mutation Bugs: Race conditions during simultaneous transactions corrupt the account balance.
4. The Ghost Payment: Customer pays, but drops connection before the browser redirects → merchant never knows.
```

### 🛡️ How This Engine Solves Them:

| Vulnerability | Production-Grade Solution Used in This Project |
| :--- | :--- |
| **Duplicate Payments & Retries** | **Two-Tier Distributed Idempotency**: Redis `SET NX` distributed locks + 24-hour response caching. |
| **Database & Queue Inconsistency** | **Transactional Outbox Pattern**: Entity state and outbox events are committed together in MongoDB; an autonomous relay dispatches to BullMQ. |
| **Corrupted Account Balances** | **Strictly Append-Only Double-Entry Ledger**: No mutable balance column exists. Balances are derived on-the-fly via MongoDB aggregation pipelines (`Credits - Debits`). Deletes & updates are blocked at the driver level. |
| **Lost or Dropped Webhooks** | **Self-Healing Reconciliation Sweeper**: Background worker actively queries the upstream processor for orphaned `PROCESSING` payments and settles them automatically. |
| **Failed Partial Refunds** | **Saga / Compensating Rollbacks**: Pre-reserves refundable amounts, invokes the processor, and automatically restores balance if all retries fail. |

---

## 🗺️ System Architecture at a Glance

The following diagram illustrates how an end-to-end payment moves through the gateway, outbox relay, background workers, ledger, and customer checkout:

```mermaid
flowchart TB
    subgraph Clients["1. Ingress Clients"]
        Merchant["Merchant API Client\n(x-api-key)"]
        Customer["Customer Browser\n(Hosted Checkout)"]
        UpstreamHook["Razorpay Webhooks\n(HMAC Signed)"]
    end

    subgraph Gateway["2. Express 5 Gateway Layer"]
        AuthMW["Auth Middleware\n(SHA-256 + Redis Cache)"]
        IdempMW["Distributed Idempotency\n(Redis SET NX)"]
        HTTPHandler["Route Controllers\n(< 50ms Response)"]
    end

    subgraph DataTier["3. Storage & Event Backbone"]
        RedisTier[("Redis 7\n- Auth Cache (300s)\n- Idemp Locks (120s)\n- BullMQ Job Queues")]
        MongoReplica[("MongoDB Replica Set\n- payments\n- outboxevents\n- refunds\n- ledgerentries (Immutable)")]
    end

    subgraph AsyncWorkers["4. Distributed Worker Pool"]
        OutboxRelay["Outbox Relay\n(Polls every 1.5s)"]
        PaymentWorker["Payment Worker\n(Order Generation)"]
        RefundWorker["Refund Worker\n(Processor Calls & Debits)"]
        ReconWorker["Reconciliation Sweeper\n(Self-Heals Stuck >3m)"]
        WebhookWorker["Webhook Worker\n(HMAC-SHA256 Merchant Dispatch)"]
    end

    subgraph Processor["5. External Payment Processor"]
        RazorpayAPI["Razorpay Payment Gateway"]
    end

    %% Ingress flows
    Merchant --> AuthMW
    AuthMW --> IdempMW
    IdempMW --> HTTPHandler

    Customer -->|Public Session| HTTPHandler
    UpstreamHook -->|POST /v1/webhooks/razorpay| HTTPHandler

    %% Ingress to Storage
    HTTPHandler -->|Write Payment + Outbox| MongoReplica
    HTTPHandler -.->|Lock / Cache| RedisTier

    %% Outbox to Queues
    OutboxRelay -->|Poll PENDING| MongoReplica
    OutboxRelay -->|Enqueue Jobs| RedisTier

    %% Worker Execution
    RedisTier -->|Pull Jobs| PaymentWorker
    PaymentWorker -->|Create Order| RazorpayAPI
    PaymentWorker -->|Update Order ID| MongoReplica

    RedisTier -->|Pull Jobs| RefundWorker
    RefundWorker -->|Execute Refund| RazorpayAPI
    RefundWorker -->|Append DEBIT Entry| MongoReplica

    RedisTier -->|Pull Jobs| WebhookWorker
    WebhookWorker -->|Send Signed POST| Merchant

    %% Reconciliation
    ReconWorker -->|Find Stuck Payments| MongoReplica
    ReconWorker -->|Verify Status| RazorpayAPI
    ReconWorker -->|Append CREDIT Entry| MongoReplica
```

---

## ⚡ How It Works in 60 Seconds

1. **Merchant creates a payment (`POST /v1/payments`)**:
   - The gateway validates `Idempotency-Key` in Redis.
   - Saves a `Payment` (`status: "CREATED"`) and an `OutboxEvent` in MongoDB.
   - Responds to the merchant in **< 50ms** with `paymentId`.
2. **Outbox Relay & Payment Worker**:
   - The Outbox Relay fetches pending events and queues a job in BullMQ.
   - The Payment Worker calls Razorpay to generate an upstream `order_id` and unlocks the payment for customer checkout (`status: "PROCESSING"`).
3. **Customer Completes Checkout**:
   - Customer opens `/checkout/:paymentId`, enters card/UPI details in the Razorpay Modal.
   - Upon completion, the cryptographic signature is verified (`orderId|paymentId` HMAC-SHA256).
   - Gateway updates status to `SUCCEEDED` and appends an immutable **CREDIT** entry to the Ledger.
4. **Double-Entry Ledger & Balance**:
   - No row in the database has a mutable `balance: 5000` field.
   - Merchant balance is computed dynamically on demand: `SUM(credits) - SUM(debits)`.
   - Modifying or deleting ledger records is rejected by database hooks with `LEDGER_IMMUTABILITY_VIOLATION`.
5. **Refunds with Compensating Saga**:
   - Merchant requests a refund (`POST /v1/refunds`).
   - The engine pre-reserves the amount from the payment.
   - The Refund Worker calls Razorpay. If successful, an immutable **DEBIT** entry is recorded. If upstream calls permanently fail after 5 retries, the pre-reserved amount is automatically rolled back.

---

## 🚀 Quickstart & Setup Guide

You can run the entire system via **Docker Compose** (recommended for instant setup) or **locally on your machine**.

### Option 1: Fast-Track with Docker Compose (Recommended)

Everything (MongoDB 7 Replica Set, Redis 7, and Node.js Backend) runs in isolated containers:

```bash
# 1. Clone the repository
git clone https://github.com/buildwithrishabh/Event-Driven-Payment-Gateway-Ledger-Engine.git
cd "Event-Driven Payment Gateway & Ledger Engine"

# 2. Configure Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env and provide your RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET

# 3. Start infrastructure and backend
cd backend
docker compose up --build
```

The gateway will automatically initialize MongoDB replica set `rs0`, connect to Redis, and listen at `http://localhost:3000`.

---

### Option 2: Local Native Setup

#### Prerequisites
- **Node.js**: v18.x or v20.x+
- **Redis**: v6.x or v7.x running on `127.0.0.1:6379`
- **MongoDB**: v6.x or v7.x running as a **Replica Set** (required for transactions)
- **Razorpay Account**: API Key & Secret ([Razorpay Dashboard](https://dashboard.razorpay.com/))

#### 1. Start MongoDB as a Replica Set
If running MongoDB natively on your machine:
```bash
# Start mongod with replica set rs0
mongod --replSet rs0 --dbpath /data/db

# In a separate terminal, initiate the replica set once:
mongosh --eval "rs.initiate()"
```

Or run MongoDB & Redis in lightweight Docker containers:
```bash
docker run -d --name payment-redis -p 6379:6379 redis:7-alpine
docker run -d --name payment-mongo -p 27017:27017 mongo:7.0 --replSet rs0
docker exec -it payment-mongo mongosh --eval "rs.initiate()"
```

#### 2. Start the Backend API & Workers
```bash
cd backend
npm install
cp .env.example .env
# Fill in your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env

# Start in development mode with live watch
npm run dev
```
> Server runs on `http://localhost:3000`. Background outbox relays and reconciliation sweepers start automatically.

#### 3. Start the Merchant Dashboard (Frontend)
```bash
cd ../frontend
npm install
cp .env.example .env

# Start Vite dev server
npm run dev
```
> Open `http://localhost:5173` in your browser.

---

## 🧪 5-Minute End-to-End Walkthrough

Test the complete lifecycle directly from your terminal using `curl`:

### Step 1: Register a Merchant
```bash
curl -X POST http://localhost:3000/v1/merchants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Starlight Store",
    "email": "payments@starlight.io",
    "webhookUrl": "https://webhook.site/your-uuid"
  }'
```
*Save the returned `apiKey` (e.g. `key_a1b2c3...`) from the response.*

---

### Step 2: Create an Idempotent Payment
```bash
curl -X POST http://localhost:3000/v1/payments \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Idempotency-Key: demo-order-001" \
  -d '{
    "amount": 50000,
    "currency": "INR",
    "customerEmail": "alex@example.com",
    "customerPhone": "9876543210"
  }'
```
> 💡 **Notice**: Run the exact same `curl` command a second time! You will receive the cached response immediately with the HTTP header `x-idempotent-replay: true`. No duplicate payment is created.

---

### Step 3: Open Customer Checkout
Copy the returned `paymentId` and navigate to:
```
http://localhost:5173/checkout/<paymentId>
```
Complete the payment using Razorpay's test cards or simulator.

---

### Step 4: Check Real-Time Double-Entry Ledger Balance
```bash
curl -X GET http://localhost:3000/v1/ledger/balance \
  -H "x-api-key: YOUR_API_KEY"
```
**Response:**
```json
{
  "merchantId": "651a2b3c4d5e6f7a8b9c0d1e",
  "balance": {
    "currency": "INR",
    "availableBalance": 50000,
    "totalCredits": 50000,
    "totalDebits": 0
  }
}
```

---

### Step 5: Issue a Partial Refund
```bash
curl -X POST http://localhost:3000/v1/refunds \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Idempotency-Key: refund-order-001" \
  -d '{
    "paymentId": "YOUR_PAYMENT_ID",
    "amount": 20000,
    "reason": "Customer return"
  }'
```
Re-check `/v1/ledger/balance`: `availableBalance` will immediately reflect `30000` (`50000` credits - `20000` debits).

---

## 📡 API Reference Overview

All amounts are integers in **minor units** (e.g. `10000` = ₹100.00).

| Method | Endpoint | Auth | Idempotency | Description |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/health` | Public | No | Health check & Redis connectivity |
| `POST` | `/v1/merchants` | Public | No | Merchant onboarding & API key generation |
| `GET` | `/v1/merchants/me` | `x-api-key` | No | Fetch authenticated merchant profile |
| `POST` | `/v1/payments` | `x-api-key` | **Required** | Ingest payment & write outbox event |
| `GET` | `/v1/payments` | `x-api-key` | No | List payments with filters & pagination |
| `GET` | `/v1/payments/:id` | `x-api-key` | No | Fetch single payment details |
| `POST` | `/v1/payments/verify` | `x-api-key` | No | Verify checkout signature & credit ledger |
| `GET` | `/v1/checkout/:id` | Public | No | Public sanitized checkout session |
| `POST` | `/v1/checkout/verify` | Public | No | Customer checkout completion verification |
| `GET` | `/v1/ledger/balance` | `x-api-key` | No | Dynamic aggregation balance |
| `GET` | `/v1/ledger/entries` | `x-api-key` | No | Paginated immutable audit entries |
| `POST` | `/v1/refunds` | `x-api-key` | **Required** | Asynchronous refund initiation |
| `GET` | `/v1/refunds` | `x-api-key` | No | List merchant refunds |
| `GET` | `/v1/refunds/:id` | `x-api-key` | No | Fetch refund status |
| `POST` | `/v1/webhooks/razorpay` | Public | HMAC | Inbound processor webhook handler |

> 📖 **For detailed schema payloads, error codes, and headers, see [ARCHITECTURE.md](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/ARCHITECTURE.md).**

---

## 📂 Project Directory Structure

```text
Event-Driven Payment Gateway & Ledger Engine/
├── ARCHITECTURE.md                  # Detailed distributed systems specification
├── README.md                        # Quickstart, overview, and API guide
│
├── backend/                         # Express 5 + BullMQ backend service
│   ├── Dockerfile                   # Production container definition
│   ├── docker-compose.yml           # Automated Mongo replica set + Redis + Backend stack
│   ├── package.json                 # Dependencies & scripts
│   └── src/
│       ├── app.js                   # Express server, security middlewares, routing
│       ├── config/
│       │   ├── db.js                # MongoDB connection handler
│       │   ├── redis.js             # ioredis client singleton
│       │   ├── razorpay.js          # Razorpay SDK client
│       │   └── logger.js            # Winston structured logger
│       ├── middleware/
│       │   ├── auth.js              # x-api-key verification & Redis cache (TTL 300s)
│       │   ├── idempotency.js       # Atomic lock (SET NX) & response replay cache
│       │   └── morgan.middleware.js # HTTP request logging
│       ├── modules/
│       │   ├── merchants/           # Merchant registration & profile
│       │   ├── payments/            # Payment model, outbox model, routes
│       │   ├── checkout/            # Public hosted customer checkout session
│       │   ├── ledger/              # Immutable ledger model & balance aggregation
│       │   ├── refunds/             # Partial/full refund service & reservation
│       │   ├── processors/          # Upstream Razorpay SDK operations
│       │   └── webhooks/            # Inbound webhook receiver & raw body parser
│       ├── queues/                  # BullMQ queue declarations (payment, refund, webhook)
│       └── workers/                 # Asynchronous background workers
│           ├── outbox.relay.js      # Polling relay: Mongo outbox -> BullMQ queues
│           ├── payment.worker.js    # Concurrency 5: Creates Razorpay orders
│           ├── refund.worker.js     # Concurrency 5: Executes refunds & ledger debits
│           ├── webhook.worker.js    # Concurrency 10: Signs HMAC & posts to merchants
│           └── reconciliation.worker.js # Sweeper: Heals stuck payments every 60s
│
└── frontend/                        # Merchant Console & Customer Checkout
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx                  # Main routing and navigation shell
        ├── pages/
        │   ├── DashboardPage.jsx    # Balance card, activity metrics, quick actions
        │   ├── PaymentsPage.jsx     # Payments table, filtering, status badges
        │   ├── RefundsPage.jsx      # Refund initiator modal & refund list
        │   ├── LedgerPage.jsx       # Immutable journal entries & audit log
        │   ├── CheckoutPage.jsx     # Customer payment portal (Razorpay modal)
        │   └── ConnectPage.jsx      # API key generation & local switcher
        └── lib/
            ├── api.js               # Typed HTTP client with auto-injected headers
            └── format.js            # Currency & minor-unit helpers
```

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env`)
```env
PORT=3000
NODE_ENV=development

# MongoDB Connection String (directConnection=true required for single replica set)
MONGODB_URI=mongodb://127.0.0.1:27017/payment_gateway?directConnection=true

# Redis Connection
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Razorpay Credentials (Test keys supported)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
```

### Frontend (`frontend/.env`)
```env
# Backend server URL without trailing slash
VITE_API_BASE_URL=http://localhost:3000
```

---

## 🏆 Engineering Highlights & Design Decisions

1. **Why Express 5?**  
   Express 5 natively resolves asynchronous errors thrown in route handlers without requiring cumbersome `try/catch` wrappers or third-party async-handler utilities.
2. **Why MongoDB Replica Set instead of standalone MongoDB?**  
   MongoDB transactions and session locks are strictly supported only on replica sets. The included `docker-compose.yml` automatically bootstraps a single-node replica set `rs0`.
3. **Why No `balance` Column?**  
   Storing mutable balances (`balance = balance + 100`) leads to irrecoverable race conditions and destroys historical auditability. By deriving balances from append-only journal entries, the ledger is mathematically incorruptible.
4. **Why Transactional Outbox instead of direct BullMQ enqueue?**  
   If the HTTP server loses power after writing to MongoDB but before enqueueing to Redis, the job is permanently lost. Writing an `outboxevent` in the database guarantees at-least-once delivery.

---

## 📄 License & Contributing

Built for high-scale, fault-tolerant financial engineering. Open for educational, portfolio, and commercial reference. PRs and architecture discussions are welcome!

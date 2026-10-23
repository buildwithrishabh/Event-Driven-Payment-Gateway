# ⚡ Event-Driven Payment Gateway & Ledger Engine

[![Node.js](https://img.shields.io/badge/Node.js-v20+-68a063?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat-square&logo=express)](https://expressjs.com/)
[![Vitest Tests](https://img.shields.io/badge/Vitest-55%20Passed-729B1B?style=flat-square&logo=vitest)](https://vitest.dev/)
[![Zod](https://img.shields.io/badge/Validation-Zod%20v3-3068b7?style=flat-square&logo=zod)](https://zod.dev/)
[![Security](https://img.shields.io/badge/Security-SSRF%20Protected-brightgreen?style=flat-square)](#-security-validation--resilience-architecture)
[![MongoDB](https://img.shields.io/badge/MongoDB-Replica_Set-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-v6-FF4438?style=flat-square)](https://bullmq.io/)
[![Prometheus](https://img.shields.io/badge/Prometheus-v2.51.0-E6522C?style=flat-square&logo=prometheus)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Grafana-v10.4.1-F46800?style=flat-square&logo=grafana)](https://grafana.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)](https://www.docker.com/)

> **A production-grade, distributed fintech engine that guarantees zero double-charges, zero lost events, mathematically immutable financial balances, strict SSRF defense, centralized Zod validation, and full-stack Prometheus/Grafana observability.**  
> Built with Node.js (Express 5), MongoDB Replica Sets, Redis, BullMQ, Razorpay SDK, Prometheus, Grafana, Vitest, and a React 18 Merchant Dashboard.

📚 **Deep-Dive Guides:**
- 🏛️ [System Architecture & Technical Design](./ARCHITECTURE.md)
- 📊 [Observability, Monitoring & Testing Guide](./OBSERVABILITY_AND_TESTING.md)

---

## 🎯 The Core Problem & Why This Exists

In typical web apps, handling payments with naive CRUD operations (`merchant.balance += amount` or calling third-party payment APIs directly inside an HTTP route) leads to catastrophic financial failures:

```
❌ The Deadly Traps of Naive Payment Systems:
1. Double Charging: A customer clicks "Pay" twice or a network retry happens → 2 charges created.
2. The Dual-Write Trap: Database write succeeds, but Redis/Kafka publish fails → payment lost in limbo.
3. Balance Mutation Bugs: Race conditions during simultaneous transactions corrupt the account balance.
4. The Ghost Payment: Customer pays, but drops connection before the browser redirects → merchant never knows.
5. SSRF & Host Exploitation: Malicious webhook URLs targeting internal services (127.0.0.1, 169.254.169.254).
6. Poison Jobs & Stuck States: Infinite retry loops or payments forever stuck in PROCESSING without timeouts.
```

### 🛡️ How This Engine Solves Them:

| Vulnerability / Edge Case | Production-Grade Solution Used in This Project |
| :--- | :--- |
| **Duplicate Payments & Retries** | **Two-Tier Distributed Idempotency**: Redis `SET NX` distributed locks + 24-hour response caching. |
| **Database & Queue Inconsistency** | **Transactional Outbox Pattern**: Entity state and outbox events are committed together in MongoDB; an autonomous relay dispatches to BullMQ. |
| **Corrupted Account Balances** | **Strictly Append-Only Double-Entry Ledger**: No mutable balance column exists. Balances are derived on-the-fly via MongoDB aggregation pipelines (`Credits - Debits`). Deletes & updates are blocked at the driver level. |
| **Lost or Dropped Webhooks** | **Self-Healing Reconciliation Sweeper**: Background worker actively queries the upstream processor for orphaned `PROCESSING` payments and settles them automatically. |
| **Failed Partial Refunds** | **Saga / Compensating Rollbacks**: Pre-reserves refundable amounts, invokes the processor, and automatically restores balance if all retries fail. |
| **SSRF / Internal Infrastructure Leaks** | **Zero-Trust SSRF Protection**: Validates outbound webhook URLs and redirect domains against RFC 1918 private subnets, cloud metadata (`169.254.169.254`), loopbacks, and DNS rebinding attacks. |
| **Malformed Ingress / Type Jailing** | **Centralized Zod Validation Layer**: Strict type coercion, object ID validation, field bounds, and RFC-standard error payloads for body, query, and params. |
| **Stuck Payments & Poison Worker Retries** | **Terminal Retry Handling & Orphan Sweeper**: Workers permanently fail exhausted jobs (`attemptsMade >= attempts`), release locks, and a dual-phase sweeper clears abandoned initializations. |
| **Blind Spots & Silent Worker Failures** | **End-to-End Observability & Vitest Suite**: Custom Prometheus metrics for queue depths, outbox lag, HTTP latency histograms, Grafana dashboards, and 55 automated unit tests. |

---

## 🗺️ System Architecture at a Glance

The following diagram illustrates how an end-to-end payment moves through the gateway, outbox relay, background workers, ledger, customer checkout, and real-time observability telemetry:

```mermaid
flowchart TB
    subgraph Clients["1. Ingress Clients"]
        Merchant["Merchant API Client\n(x-api-key, Idempotency-Key)"]
        Customer["Customer Browser\n(Hosted Checkout)"]
        UpstreamHook["Razorpay Webhooks\n(HMAC Signed)"]
    end

    subgraph Gateway["2. Express 5 Gateway Layer"]
        RawBody["Raw Body Buffer\n(HMAC Preservation)"]
        ZodVal["Zod Validation Layer\n(params, query, body)"]
        AuthMW["Auth Middleware\n(SHA-256 + Redis Cache)"]
        IdempMW["Distributed Idempotency\n(Redis SET NX)"]
        HTTPHandler["Route Controllers\n(< 50ms Response)"]
        SSRFValidator["SSRF Guard\n(Webhook & Redirects)"]
        MetricsRoute["Metrics Scrape\n(GET /metrics)"]
    end

    subgraph DataTier["3. Storage & Event Backbone"]
        RedisTier[("Redis 7\n- Auth Cache (300s)\n- Idemp Locks (120s)\n- BullMQ Job Queues")]
        MongoReplica[("MongoDB Replica Set\n- payments\n- outboxevents\n- refunds\n- ledgerentries (Immutable)")]
    end

    subgraph AsyncWorkers["4. Distributed Worker Pool"]
        OutboxRelay["Outbox Relay\n(Polls every 1.5s)"]
        PaymentWorker["Payment Worker\n(Order Gen + Terminal Retries)"]
        RefundWorker["Refund Worker\n(Processor + Saga Compensations)"]
        ReconWorker["Reconciliation Sweeper\n(Dual-Phase: Stuck & Orphaned)"]
        WebhookWorker["Webhook Worker\n(SSRF Guarded + HMAC Signed)"]
    end

    subgraph Processor["5. External Payment Processor"]
        RazorpayAPI["Razorpay Payment Gateway"]
    end

    subgraph Observability["6. Real-Time Observability Stack"]
        Prometheus["Prometheus (v2.51.0)\n(Port 9090 - Scrapes /metrics)"]
        Grafana["Grafana Dashboards (v10.4.1)\n(Port 3001 - Pre-provisioned)"]
    end

    %% Ingress flows
    Merchant --> RawBody --> ZodVal --> AuthMW --> IdempMW --> HTTPHandler
    Customer -->|Public Session| ZodVal --> HTTPHandler
    UpstreamHook -->|POST /v1/webhooks/razorpay| RawBody --> HTTPHandler

    %% Ingress to Storage & Security
    HTTPHandler --> SSRFValidator
    HTTPHandler -->|Write Payment + Outbox| MongoReplica
    HTTPHandler -.->|Lock / Cache| RedisTier

    %% Outbox to Queues
    OutboxRelay -->|Poll PENDING| MongoReplica
    OutboxRelay -->|Enqueue Jobs| RedisTier

    %% Worker Execution
    RedisTier -->|Pull Jobs| PaymentWorker
    PaymentWorker -->|Create Order| RazorpayAPI
    PaymentWorker -->|Update Order ID / Terminal FAILED| MongoReplica

    RedisTier -->|Pull Jobs| RefundWorker
    RefundWorker -->|Execute Refund| RazorpayAPI
    RefundWorker -->|Append DEBIT / Compensate Rollback| MongoReplica

    RedisTier -->|Pull Jobs| WebhookWorker
    WebhookWorker --> SSRFValidator
    WebhookWorker -->|Send Signed POST| Merchant

    %% Reconciliation
    ReconWorker -->|Find Stuck & Orphaned| MongoReplica
    ReconWorker -->|Verify Status| RazorpayAPI
    ReconWorker -->|Append CREDIT / Fail Orphan| MongoReplica

    %% Observability flows
    HTTPHandler --> MetricsRoute
    MetricsRoute -.->|Scrapes Metrics| Prometheus
    Prometheus -->|Datasource| Grafana
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

Everything (**MongoDB 7 Replica Set**, **Redis 7**, **Node.js Backend**, **Prometheus v2.51**, and **Grafana v10.4**) runs in isolated containers:

```bash
# 1. Clone the repository
git clone https://github.com/buildwithrishabh/Event-Driven-Payment-Gateway-Ledger-Engine.git
cd "Event-Driven Payment Gateway & Ledger Engine"

# 2. Configure Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env and provide your RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET

# 3. Start infrastructure, backend, and monitoring stack
cd backend
docker compose up --build
```

The gateway will automatically initialize MongoDB replica set `rs0`, connect to Redis, and spin up services:
- **Payment Gateway API**: `http://localhost:3000`
- **Prometheus Telemetry Scraper**: `http://localhost:9090`
- **Grafana Live Dashboards**: `http://localhost:3001` (Pre-configured login: `admin` / `admin`)

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

#### 3. Run Automated Unit Test Suite (Vitest)
```bash
# Execute all 55 unit tests (Zero-network / mock isolated)
npm test

# Run tests in live watch mode during development
npm run test:watch
```
> All 55 tests pass in < 1.5 seconds covering SSRF validation, Zod request schemas, append-only ledger math, saga rollback triggers, and distributed idempotency.

#### 4. Start the Merchant Dashboard (Frontend)
```bash
cd ../frontend
npm install
cp .env.example .env

# Start Vite dev server
npm run dev
```
> Open `http://localhost:5173` in your browser.

---

## 🛡️ Security, Validation & Resilience Architecture

Modern financial engines face threats not just from external malicious actors, but from poisoned payloads, infrastructure pivoting, and asynchronous worker lockouts. This engine introduces three hardened defense layers:

### 1. Enterprise SSRF Defense (`ssrfValidator.js`)
Payment gateways must frequently dispatch outbound webhooks to arbitrary URLs supplied by merchants. Naive implementations allow attackers to supply URLs like `http://169.254.169.254/latest/meta-data/` (cloud metadata) or `http://127.0.0.1:6379` (Redis unauthorized command injection).

Our SSRF validator performs deep defense-in-depth:
- **Private & Loopback Filtering**: Blocks IPv4 loopback (`127.0.0.0/8`), RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), Link-local / Cloud metadata (`169.254.0.0/16`), and IPv6 equivalents (`::1`, `fc00::/7`, `fe80::/10`).
- **DNS Resolution Validation**: Resolves domain names via asynchronous DNS before connection, ensuring the resolved target IP is public and non-reserved (preventing DNS rebinding attacks).
- **Protocol & Credential Whitelisting**: Strictly restricts protocols to `https:` (mandatory in production) and `http:` (local dev only). Rejects embedded credentials in URLs (`https://user:pass@host`).
- **Integration Points**: Enforced on merchant registration, webhook dispatch worker, payment redirect URLs, and checkout return endpoints.

### 2. Centralized Zod Validation Layer (`validate.middleware.js` & `validations/index.js`)
All incoming requests pass through deterministic Zod schema validation before touching controllers or business services:
- **Coercion & Bounds Checking**: Handles string-to-integer conversions, pagination bounds (`limit <= 50`), and minor-unit currency amounts (`amount >= 100` paise).
- **Flexible ID Resolution**: Validates 24-character hexadecimal MongoDB ObjectIds and transparently supports upstream processor IDs (e.g., Razorpay `rfnd_...` refund identifiers).
- **RFC-Compliant Structured Errors**: Unifies error formatting across the application:
  ```json
  {
    "error": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "amount",
        "message": "amount is required, must be a number, and minimum 100 minor units (e.g., 100 paise = 1 INR)"
      }
    ]
  }
  ```

### 3. Terminal Retry Handling & Dual-Phase Reconciliation Sweeper
To eliminate "poison jobs" that cause endless worker crash loops and stuck transaction states:
- **BullMQ Terminal Retry Guards**: Both `payment.worker.js` and `refund.worker.js` track `attemptsMade >= attempts`. When max retries are exhausted, the worker atomically transitions the record to `FAILED`, releases processing locks, triggers compensating balance rollbacks, emits `payment.failed` / `refund.failed` merchant webhooks, and logs audit events.
- **Dual-Phase Reconciliation Sweeper (`reconciliation.worker.js`)**:
  - **Phase 1 (Stuck Upstream Check)**: Scans payments in `PROCESSING` status with an assigned `razorpayOrderId` older than 3 minutes. Queries Razorpay's API to detect if the customer completed payment; if captured, settles the payment and writes ledger credit.
  - **Phase 2 (Orphan Cleanup)**: Scans orphaned payments in `CREATED` or `PROCESSING` without a `razorpayOrderId` older than 10 minutes. Automatically marks them `FAILED`, records timeout reasons, and dispatches terminal webhooks.

---

## 📊 Real-Time Observability & Monitoring (Prometheus + Grafana)

The gateway engine includes an enterprise-grade observability stack built on Prometheus and Grafana. No manual setup or UI dashboard configuration is required—everything is provisioned automatically via Docker Compose.

```
┌─────────────────────────────────┐        Scrapes /metrics        ┌───────────────────────────┐
│ Express 5 Engine & BullMQ Workers├───────────────────────────────► Prometheus (Port 9090)    │
│  - Runtime & Node.js metrics    │          every 15s            │  - Scrapes backend:3000   │
│  - Custom fintech counters      │                               │  - Stores time-series data│
│  - Histogram latency buckets    │                               └─────────────┬─────────────┘
└─────────────────────────────────┘                                             │
                                                                                │ Datasource Query
                                                                                ▼
                                                                  ┌───────────────────────────┐
                                                                  │ Grafana (Port 3001)       │
                                                                  │  - "⚡ Payment Gateway"    │
                                                                  │  - Zero-config Dashboard  │
                                                                  └───────────────────────────┘
```

### 📈 Core Metrics Tracked

| Metric Name | Type | Labels | Description / Alert Value |
| :--- | :---: | :--- | :--- |
| `payment_gw_outbox_pending_events` | **Gauge** | — | Pending unpublished events in MongoDB outbox collection. Highlights outbox relay lag (>20 indicates worker stall). |
| `payment_gw_queue_jobs` | **Gauge** | `queue`, `status` | Active, waiting, completed, failed, and delayed job counts across `payment-process`, `refund-processing-queue`, and `webhook-delivery`. |
| `payment_gw_payments_total` | **Counter** | `status`, `currency` | Total count of processed payments partitioned by terminal state (`SUCCEEDED`, `FAILED`). |
| `payment_gw_refunds_total` | **Counter** | `status` | Total count of processed refunds partitioned by state (`SUCCEEDED`, `FAILED`). |
| `payment_gw_webhooks_total` | **Counter** | `status` | Total count of HMAC-signed outbound merchant webhooks dispatched (`SUCCESS`, `FAILED`). |
| `payment_gw_http_request_duration_seconds` | **Histogram** | `method`, `route`, `status_code` | HTTP API request latency duration with granular buckets (`0.05s`, `0.1s`, `0.25s`, `0.5s`, `1s`, `2.5s`, `5s`). Used for P50, P95, and P99 percentiles. |
| `payment_gw_nodejs_*` | **Default** | — | Node.js process health: Heap memory used/total, active event-loop lag, active libuv handles, and CPU utilization. |

### 🖥️ Provisioned Grafana Dashboard Panels (`http://localhost:3001`)

The pre-provisioned dashboard (**"⚡ Payment Gateway Engine"**) is organized into 4 critical operational rows:
1. **Core Engine Status & Metrics**: Live gauges and stats for Outbox Pending Events (with color-coded green/yellow/red alert thresholds), Total Processed Payments, Processed Refunds, and Webhook Deliveries.
2. **BullMQ Queue Depth**: Stacked time-series graph displaying waiting and active jobs across all 3 distributed queues.
3. **HTTP API Performance**: Real-time HTTP requests-per-second (RPS) by route and P95 / P99 latency percentile curves.
4. **Node.js Runtime Health**: V8 Heap memory utilization (MB) and Event Loop Lag (ms) to detect memory leaks or synchronous blocking.

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

All amounts are integers in **minor units** (e.g. `10000` = ₹100.00). Request inputs are strictly validated against Zod schemas.

| Method | Endpoint | Auth | Idempotency | Description |
| :--- | :--- | :---: | :---: | :--- |
| `GET` | `/health` | Public | No | Health check & Redis connectivity |
| `GET` | `/metrics` | Public | No | Prometheus telemetry scrape endpoint |
| `POST` | `/v1/merchants` | Public | No | Merchant onboarding & API key generation (SSRF validated) |
| `GET` | `/v1/merchants/me` | `x-api-key` | No | Fetch authenticated merchant profile |
| `POST` | `/v1/payments` | `x-api-key` | **Required** | Ingest payment & write outbox event (Zod validated) |
| `GET` | `/v1/payments` | `x-api-key` | No | List payments with filters & pagination (page, limit) |
| `GET` | `/v1/payments/:id` | `x-api-key` | No | Fetch single payment details (ObjectId validated) |
| `POST` | `/v1/payments/verify` | `x-api-key` | No | Verify checkout signature & credit ledger |
| `GET` | `/v1/checkout/:id` | Public | No | Public sanitized checkout session (ObjectId validated) |
| `POST` | `/v1/checkout/verify` | Public | No | Customer checkout completion & HMAC signature verification |
| `GET` | `/v1/ledger/balance` | `x-api-key` | No | Dynamic aggregation balance |
| `GET` | `/v1/ledger/entries` | `x-api-key` | No | Paginated immutable audit entries |
| `POST` | `/v1/refunds` | `x-api-key` | **Required** | Asynchronous refund initiation (Zod validated) |
| `GET` | `/v1/refunds` | `x-api-key` | No | List merchant refunds with filters & pagination |
| `GET` | `/v1/refunds/:id` | `x-api-key` | No | Fetch refund status (Supports ObjectId or Processor ID `rfnd_...`) |
| `POST` | `/v1/webhooks/razorpay` | Public | HMAC | Inbound processor webhook handler (Raw body preserved) |

> 📖 **For detailed schema payloads, error codes, and headers, see [ARCHITECTURE.md](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/ARCHITECTURE.md).**

---

## 📂 Project Directory Structure

```text
Event-Driven Payment Gateway & Ledger Engine/
├── ARCHITECTURE.md                  # Comprehensive distributed architecture specification
├── OBSERVABILITY_AND_TESTING.md     # In-depth Prometheus/Grafana & Vitest guide
├── README.md                        # Quickstart, security overview, and API guide
│
├── backend/                         # Express 5 + BullMQ backend service
│   ├── Dockerfile                   # Production container definition
│   ├── docker-compose.yml           # Multi-container stack (Mongo RS, Redis, Backend, Prometheus, Grafana)
│   ├── package.json                 # Dependencies & scripts
│   ├── vitest.config.js             # Vitest test runner configuration
│   ├── monitoring/                  # Observability infrastructure provisioning
│   │   ├── prometheus/
│   │   │   └── prometheus.yaml      # Scrape targets & intervals (backend:3000)
│   │   └── grafana/
│   │       └── provisioning/
│   │           ├── datasources/
│   │           │   └── prometheus.yaml # Automatic Prometheus datasource setup
│   │           └── dashboards/
│   │               ├── dashboard.yaml  # Dashboards loader configuration
│   │               └── definitions/
│   │                   └── payment_engine.json # Pre-built Grafana visual dashboard
│   ├── tests/                       # Automated Unit & Security Test Suites (55 passing)
│   │   └── unit/
│   │       ├── validation.test.js   # Zod request validation & error format tests (19 tests)
│   │       ├── security.test.js     # SSRF defense & HMAC signature tests (9 tests)
│   │       ├── middleware.test.js   # Auth caching & idempotency lock tests (14 tests)
│   │       ├── ledger.test.js       # Append-only ledger math & immutability tests (7 tests)
│   │       └── refund.test.js       # Saga rollback & refund boundary tests (6 tests)
│   └── src/
│       ├── app.js                   # Express server, graceful shutdown, metrics route
│       ├── config/
│       │   ├── db.js                # MongoDB connection handler
│       │   ├── redis.js             # ioredis client singleton
│       │   ├── razorpay.js          # Razorpay SDK client
│       │   ├── logger.js            # Winston structured logger
│       │   └── metrics.js           # prom-client Prometheus metrics registry
│       ├── middleware/
│       │   ├── auth.js              # x-api-key verification & Redis cache (TTL 300s)
│       │   ├── idempotency.js       # Atomic lock (SET NX) & response replay cache
│       │   ├── validate.middleware.js # Centralized Zod request validator (params/query/body)
│       │   ├── error.middleware.js  # Express 5 centralized error & 404 handler
│       │   └── morgan.middleware.js # HTTP request logging
│       ├── validations/
│       │   └── index.js             # Centralized Zod schemas for all modules
│       ├── utils/
│       │   └── ssrfValidator.js     # Zero-trust SSRF protection (DNS & private IP check)
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
│           ├── outbox.relay.js      # Polling relay: Mongo outbox -> BullMQ queues (tracks lag)
│           ├── payment.worker.js    # Concurrency 5: Creates Razorpay orders & terminal failure guards
│           ├── refund.worker.js     # Concurrency 5: Executes refunds, ledger debits, & saga rollbacks
│           ├── webhook.worker.js    # Concurrency 10: SSRF-validated HMAC merchant dispatch
│           └── reconciliation.worker.js # Sweeper: Dual-phase self-healing every 60s
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
5. **Why Zero-Trust SSRF Protection?**  
   Merchant webhooks and checkout redirects are inherent attack vectors for internal port scans and cloud metadata credential harvesting (`169.254.169.254`). Validating every URL against private CIDRs and DNS resolutions protects internal services.
6. **Why Centralized Zod Validation?**  
   Validating route params, queries, and bodies at the middleware boundary prevents invalid data from ever reaching database models or worker queues, providing explicit, typed error messages.
7. **Why Full-Stack Prometheus + Grafana Observability?**  
   In distributed asynchronous architectures, silent worker stalls and outbox backlogs can go unnoticed without telemetry. Integrating `prom-client` with a provisioned Grafana dashboard provides immediate visual alerts on queue depths, outbox lag, and API latency percentiles.
8. **Graceful Shutdown & Resilience**:  
   On receiving `SIGINT` or `SIGTERM`, the gateway closes HTTP listener sockets, terminates recurring polling sweepers, and cleanly terminates Redis and MongoDB connections without dropping in-flight transactions.

---

## 📄 License & Contributing

Built for high-scale, fault-tolerant financial engineering. Open for educational, portfolio, and commercial reference. PRs and architecture discussions are welcome!



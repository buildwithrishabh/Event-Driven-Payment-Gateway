# 🏛️ Distributed Systems Architecture & Engineering Specification

> **An in-depth technical specification of the distributed failure handling, transactional guarantees, asynchronous processing, idempotency controls, and double-entry ledger mechanics powering the Event-Driven Payment Gateway.**

---

## 📑 Table of Contents

1. [Executive Summary & Mental Model](#1-executive-summary--mental-model)
2. [High-Level System Topology Diagram](#2-high-level-system-topology-diagram)
3. [The 9 Core Architectural Pillars](#3-the-9-core-architectural-pillars)
   - [Pillar 1: Two-Tier Distributed Idempotency](#pillar-1-two-tier-distributed-idempotency)
   - [Pillar 2: Transactional Outbox Pattern](#pillar-2-transactional-outbox-pattern)
   - [Pillar 3: Worker Concurrency & Atomic Task Claims](#pillar-3-worker-concurrency--atomic-task-claims)
   - [Pillar 4: Immutable Double-Entry Financial Ledger](#pillar-4-immutable-double-entry-financial-ledger)
   - [Pillar 5: Asynchronous Refund Engine with Compensating Rollbacks](#pillar-5-asynchronous-refund-engine-with-compensating-rollbacks)
   - [Pillar 6: Self-Healing Reconciliation Engine](#pillar-6-self-healing-reconciliation-engine)
   - [Pillar 7: Cryptographic Webhook Security (Inbound & Outbound)](#pillar-7-cryptographic-webhook-security-inbound--outbound)
   - [Pillar 8: Full-Stack Observability & Telemetry (Prometheus & Grafana)](#pillar-8-full-stack-observability--telemetry-prometheus--grafana)
   - [Pillar 9: Production Resilience, Graceful Shutdown & Centralized Error Architecture](#pillar-9-production-resilience-graceful-shutdown--centralized-error-architecture)
4. [End-to-End Execution Sequence Diagrams](#4-end-to-end-execution-sequence-diagrams)
   - [Flow 1: Payment Ingestion & Fast API Return](#flow-1-payment-ingestion--fast-api-return)
   - [Flow 2: Outbox Polling & Upstream Order Creation](#flow-2-outbox-polling--upstream-order-creation)
   - [Flow 3: Customer Checkout & Cryptographic Signature Verification](#flow-3-customer-checkout--cryptographic-signature-verification)
   - [Flow 4: Inbound Webhook Processing](#flow-4-inbound-webhook-processing)
   - [Flow 5: Partial / Full Refund Lifecycle with Saga Rollback](#flow-5-partial--full-refund-lifecycle-with-saga-rollback)
   - [Flow 6: Autonomous Reconciliation Sweep](#flow-6-autonomous-reconciliation-sweep)
   - [Flow 7: Outbound Webhook Delivery with Exponential Backoff](#flow-7-outbound-webhook-delivery-with-exponential-backoff)
   - [Flow 8: Prometheus Telemetry Scraping & Grafana Dashboard Rendering](#flow-8-prometheus-telemetry-scraping--grafana-dashboard-rendering)
5. [State Machines & Entity Lifecycles](#5-state-machines--entity-lifecycles)
   - [Payment State Machine](#payment-state-machine)
   - [Refund State Machine](#refund-state-machine)
6. [Distributed Failure Modes & Disaster Recovery Matrix](#6-distributed-failure-modes--disaster-recovery-matrix)
7. [Codebase Reference Map](#7-codebase-reference-map)

---

## 1. Executive Summary & Mental Model

### The 3-Tier Mental Model
To understand this system on the first read, picture it as three distinct, loosely coupled layers operating asynchronously:

```
┌────────────────────────────────────────────────────────────────────────┐
│  TIER 1: FAST INGRESS GATEWAY (<50ms SLA)                              │
│  - Verifies merchant API keys against Redis in 1ms.                    │
│  - Acquires atomic Redis lock on Idempotency-Key.                      │
│  - Persists Payment (CREATED) + OutboxEvent (PENDING) in one DB write. │
│  - Immediately returns HTTP 201 Created to caller.                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Asynchronous Polling Relay)
┌───────────────────────────────────▼────────────────────────────────────┐
│  TIER 2: EVENT-DRIVEN RELAY & DISTRIBUTED QUEUES (BullMQ)              │
│  - Outbox Relay discovers PENDING events every 1.5s.                   │
│  - Enqueues jobs into Redis BullMQ with deterministic deduplication.   │
│  - Worker pools claim jobs atomically with processing locks.           │
│  - Communicates with upstream processor (Razorpay) via retries.        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Verified Payment / Refund Success)
┌───────────────────────────────────▼────────────────────────────────────┐
│  TIER 3: IMMUTABLE DOUBLE-ENTRY LEDGER & RECONCILIATION                │
│  - Database driver rejects UPDATE and DELETE operations on entries.    │
│  - Balance is calculated dynamically: SUM(Credits) - SUM(Debits).      │
│  - Background sweeper heals lost or abandoned payments every 60s.      │
│  - Outbound webhooks dispatch HMAC-signed events to merchants.         │
│  - Telemetry scraped via Prometheus & visualized live in Grafana.      │
└────────────────────────────────────────────────────────────────────────┘
```

### Why Naive Payment Gateways Fail
1. **Synchronous Upstream HTTP Calls**: Calling Stripe/Razorpay inside the API route ties up HTTP server threads. If the upstream takes 8 seconds or times out, the client crashes or retries, causing duplicate charges.
2. **Dual-Write Vulnerability**: Saving to a database and then calling a message queue are two separate operations. If the server crashes between them, the payment is orphaned forever.
3. **In-Place Balance Mutation**: Doing `merchant.balance += amount` destroys auditability. If a bug occurs, there is no way to mathematically prove why a balance is what it is.
4. **Blind Worker Failures**: Without custom metrics and queue lag telemetry, backlogs and stuck jobs can silently stall transactions unnoticed.

---

## 2. High-Level System Topology Diagram

```mermaid
flowchart TB
    subgraph Clients["Ingress & External Actors"]
        MerchantServer["Merchant Backend\n(Sends API requests via x-api-key)"]
        CustomerBrowser["End-Customer Browser\n(Hosted Checkout UI)"]
        RazorpayIngress["Razorpay Webhook Servers\n(Sends payment.captured)"]
    end

    subgraph Gateway["Express 5 Gateway Layer"]
        HTTPRouter["Express Router (/v1/*)"]
        AuthMiddleware["Auth Middleware\n(SHA-256 Hash + Redis Cache)"]
        IdempMiddleware["Idempotency Middleware\n(Redis SET NX + Replay Cache)"]
        RawBodyParser["Raw Body Parser\n(Preserves raw bytes for HMAC)"]
        MetricsEndpoint["Metrics Route\n(GET /metrics)"]
    end

    subgraph InMemory["In-Memory Tier (Redis 7)"]
        AuthCache[("Auth Cache\nKey: auth:merchant:hash\nTTL: 300s")]
        IdempStore[("Idempotency Store\nKey: idempotency:merchant:key\nTTL: 120s Lock / 24h Replay")]
        BullQueues[("BullMQ Queues\n- payment-process\n- refund-processing-queue\n- webhook-delivery")]
    end

    subgraph Storage["Primary Storage (MongoDB Replica Set)"]
        ColMerchants[("merchants")]
        ColPayments[("payments\n(State: CREATED, PROCESSING, SUCCEEDED)")]
        ColOutbox[("outboxevents\n(status: PENDING, PROCESSED, FAILED)")]
        ColRefunds[("refunds\n(status: PENDING, PROCESSING, SUCCEEDED)")]
        ColLedger[("ledgerentries\n(IMMUTABLE: No Updates or Deletes)")]
        ColWebhookLogs[("webhookdeliveries\n(Audit trail of attempts)")]
    end

    subgraph Workers["Distributed Background Workers"]
        OutboxRelay["Outbox Relay\n(Polls every 1.5s)"]
        PaymentWorker["Payment Worker\n(Concurrency: 5)"]
        RefundWorker["Refund Worker\n(Concurrency: 5)"]
        ReconSweeper["Reconciliation Sweeper\n(Runs every 60s)"]
        WebhookWorker["Webhook Worker\n(Concurrency: 10)"]
    end

    subgraph Observability["Telemetry & Observability Stack"]
        PrometheusServer["Prometheus Server (v2.51.0)\n(Scrapes backend:3000/metrics)"]
        GrafanaServer["Grafana Dashboard (v10.4.1)\n(Port 3001: Payment Engine)"]
    end

    subgraph External["External Services"]
        RazorpayAPI["Razorpay Payment Gateway API"]
    end

    %% Client Interactions
    MerchantServer -->|"1. POST /v1/payments"| HTTPRouter
    CustomerBrowser -->|"2. Public Checkout / Verify"| HTTPRouter
    RazorpayIngress -->|"3. Inbound Webhooks"| HTTPRouter

    %% Gateway Pipeline
    HTTPRouter --> RawBodyParser
    RawBodyParser --> AuthMiddleware
    AuthMiddleware -->|"Check cached profile"| AuthCache
    AuthMiddleware -.->|"Cache miss: query DB"| ColMerchants
    AuthMiddleware --> IdempMiddleware
    IdempMiddleware -->|"SET NX Lock"| IdempStore

    %% Ingress to Storage
    IdempMiddleware -->|"Write Payment & OutboxEvent"| ColPayments
    IdempMiddleware -->|"Write OutboxEvent"| ColOutbox

    %% Outbox Relay Pipeline
    OutboxRelay -->|"Poll PENDING events"| ColOutbox
    OutboxRelay -->|"Enqueue job with deduplication key"| BullQueues
    OutboxRelay -->|"Mark event PROCESSED"| ColOutbox

    %% Workers Execution
    BullQueues -->|"Pull payment job"| PaymentWorker
    PaymentWorker -->|"Atomic claim (CREATED -> PROCESSING)"| ColPayments
    PaymentWorker -->|"Create Order"| RazorpayAPI
    PaymentWorker -->|"Save razorpayOrderId"| ColPayments

    BullQueues -->|"Pull refund job"| RefundWorker
    RefundWorker -->|"Atomic claim"| ColRefunds
    RefundWorker -->|"Execute refund"| RazorpayAPI
    RefundWorker -->|"Append DEBIT entry"| ColLedger
    RefundWorker -.->|"Rollback on terminal failure"| ColPayments

    ReconSweeper -->|"Find stuck payments (>3m)"| ColPayments
    ReconSweeper -->|"Verify capture status"| RazorpayAPI
    ReconSweeper -->|"Append CREDIT entry"| ColLedger

    BullQueues -->|"Pull webhook job"| WebhookWorker
    WebhookWorker -->|"Sign HMAC-SHA256"| WebhookWorker
    WebhookWorker -->|"Dispatch POST"| MerchantServer
    WebhookWorker -->|"Log attempt"| ColWebhookLogs

    %% Observability Scrapes & Queries
    HTTPRouter --> MetricsEndpoint
    MetricsEndpoint -.->|"Scrapes every 15s"| PrometheusServer
    PrometheusServer -->|"Visualized in"| GrafanaServer
```

---

## 3. The 9 Core Architectural Pillars

### Pillar 1: Two-Tier Distributed Idempotency
- **Source Code**: [backend/src/middleware/idempotency.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/middleware/idempotency.js)
- **The Problem**: If a network glitch occurs after a merchant requests a payment, the merchant client retries. Without protection, two charges are created for the same customer.
- **The Solution**: Every mutating request requires an `Idempotency-Key` HTTP header. The engine uses Redis atomic primitives to guarantee exactly-once processing semantics:

```
Request with Idempotency-Key: "order_9988"
                     │
         Redis SET NX (120s TTL)
        ┌────────────┴────────────┐
   [Lock Acquired]          [Lock Failed]
        │                         │
  Execute Gateway          Inspect Redis Key
   Save to DB                     │
        │             ┌───────────┴───────────┐
 Cache response       │                       │
 state: COMPLETED     │                       │
 24h TTL (86400s)     ▼                       ▼
        │        State = "PROCESSING"    State = "COMPLETED"
 Return 201           │                       │
                 Return 409 Conflict     Replay original response
                 ("Request in-flight")   with header:
                                         x-idempotent-replay: true
```

#### Under the Hood:
```javascript
// 1. Atomic Lock Acquisition
const redisKey = `idempotency:${req.merchant._id}:${idempotencyKey}`;
const lockAcquired = await redisClient.set(
  redisKey,
  JSON.stringify({ state: "PROCESSING" }),
  "EX", 120, "NX"
);

// 2. Intercept response and cache for 24 hours
res.json = function (body) {
  redisClient.set(
    redisKey,
    JSON.stringify({ state: "COMPLETED", statusCode: res.statusCode, body }),
    "EX", 86400
  );
  return originalJson.call(this, body);
};
```

---

### Pillar 2: Transactional Outbox Pattern
- **Source Code**: [outbox.model.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/modules/payments/outbox.model.js), [outbox.relay.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/outbox.relay.js)
- **The Problem**: "Dual-Write Vulnerability". If an API writes to MongoDB and then tries to publish directly to Redis/BullMQ, a power outage or restart between these two steps will cause the event to be permanently lost.
- **The Solution**: The controller persists the entity (`Payment`) and an `OutboxEvent` document in MongoDB. The HTTP request terminates cleanly in under 50ms. An autonomous Outbox Relay polls pending records and relays them to BullMQ:

```
[HTTP Request] ────────► MongoDB: Insert Payment + OutboxEvent (PENDING)
                                  │
                                  ▼
[Outbox Relay] ────────► Polls PENDING events (FIFO limit 20)
(Runs every 1.5s)                 │
                                  ├──► Pushes to BullMQ (Job ID: `pay_${paymentId}`)
                                  └──► Marks OutboxEvent: PROCESSED
```

#### Deduplication Guarantee:
Even if the relay crashes right after enqueueing, BullMQ uses deterministic job IDs (`jobId: pay_${paymentId}`). If an event is re-enqueued, BullMQ automatically ignores the duplicate.

---

### Pillar 3: Worker Concurrency & Atomic Task Claims
- **Source Code**: [payment.worker.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/payment.worker.js)
- **The Problem**: Multiple worker instances running concurrently could pick up the same job and trigger redundant upstream processor API calls.
- **The Solution**: An atomic `findOneAndUpdate` state transition guarantees single-worker execution:

```javascript
const payment = await Payment.findOneAndUpdate(
  {
    _id: paymentId,
    status: "CREATED", // Atomic check: only claim if not yet taken
  },
  {
    status: "PROCESSING",
    processingLock: {
      workerId: `worker_${os.hostname()}_${process.pid}`,
      lockedAt: new Date(),
    },
  },
  { returnDocument: "after" }
);

if (!payment) return; // Another worker already claimed this task
```
- If Razorpay order creation succeeds, `razorpayOrderId` is saved and the lock is cleared.
- If it fails, `status` resets to `CREATED` and BullMQ's exponential backoff triggers a retry (up to 3 attempts).

---

### Pillar 4: Immutable Double-Entry Financial Ledger
- **Source Code**: [ledger.model.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/modules/ledger/ledger.model.js), [ledger.service.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/modules/ledger/ledger.service.js)
- **The Problem**: Traditional systems store a mutable balance (e.g. `merchant.balance = 5000`). If a database update fails mid-way, or concurrent threads update the balance at the same instant, money is lost or created out of thin air.
- **The Solution**: 
  1. **Zero Mutable State**: There is no balance column in the database.
  2. **Append-Only Journal**: Every monetary change is recorded as an immutable `CREDIT` or `DEBIT` entry.
  3. **Driver-Level Immutability Guard**: Any attempt to run an update or delete query throws an error immediately:

```javascript
// Strict Driver-Level Immutability Guard
ledgerEntrySchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany"],
  function () {
    throw new Error("LEDGER_IMMUTABILITY_VIOLATION: Ledger entries cannot be modified or deleted.");
  }
);
```

#### Real-Time Mathematical Balance Calculation:
When `/v1/ledger/balance` is requested, MongoDB computes the sum via an aggregation pipeline:

$$\text{Available Balance} = \sum \text{Credits} - \sum \text{Debits}$$

```javascript
const pipeline = [
  { $match: { merchantId: new mongoose.Types.ObjectId(merchantId) } },
  {
    $group: {
      _id: "$currency",
      totalCredits: { $sum: { $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0] } },
      totalDebits: { $sum: { $cond: [{ $eq: ["$type", "DEBIT"] }, "$amount", 0] } },
    },
  },
  {
    $project: {
      availableBalance: { $subtract: ["$totalCredits", "$totalDebits"] },
      totalCredits: 1,
      totalDebits: 1,
    },
  },
];
```

---

### Pillar 5: Asynchronous Refund Engine with Compensating Rollbacks
- **Source Code**: [refund.service.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/modules/refunds/refund.service.js), [refund.worker.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/refund.worker.js)
- **The Problem**: A merchant issues two concurrent refund requests for ₹500 on a ₹800 payment. If not coordinated, both pass validation, refunding ₹1,000 (an overdraft). Furthermore, if the upstream bank rejects the refund, money must not be locked forever.
- **The Solution (Saga with Compensating Action)**:
  1. **Pre-Reservation**: During ingestion, the requested amount is atomically added to `payment.refundedAmount`. If `(refundedAmount + requested) > amount`, the request is immediately rejected.
  2. **Asynchronous Execution**: The Refund Worker invokes Razorpay's refund API with up to 5 exponential backoff retries.
  3. **Success**: An immutable **DEBIT** entry is recorded in the Ledger.
  4. **Compensating Rollback**: If Razorpay permanently rejects the refund after exhausting all 5 attempts:
     ```javascript
     // Compensating rollback restores the refundable balance
     await Payment.findByIdAndUpdate(refund.paymentId, {
       $inc: { refundedAmount: -refund.amount }
     });
     refund.status = "FAILED";
     await refund.save();
     ```

---

### Pillar 6: Self-Healing Reconciliation Engine
- **Source Code**: [reconciliation.worker.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/reconciliation.worker.js)
- **The Problem**: In real-world e-commerce, a customer authorizes payment in Razorpay and closes the browser window before the checkout verification callback runs. If Razorpay's webhook is delayed or dropped, the payment is stuck in `PROCESSING` forever.
- **The Solution**: An autonomous sweeper runs every 60 seconds to detect and heal abandoned payments:

```
[Reconciliation Sweeper (Runs every 60s)]
                     │
   Find payments where:
   - status == "PROCESSING"
   - razorpayOrderId != null
   - updatedAt < (Now - 3 minutes)
                     │
   Query Razorpay API: fetchOrderPayments(razorpayOrderId)
                     │
      ┌──────────────┴──────────────┐
  [Captured Payment Found]    [No Capture Found]
      │                             │
  Update Payment -> SUCCEEDED       Was payment created > 10m ago?
  Append Ledger CREDIT              ┌───────┴───────┐
  Dispatch merchant webhook        Yes              No
                                    │               │
                            Update -> FAILED    Leave for next
                            Dispatch webhook       sweep
```

---

### Pillar 7: Cryptographic Webhook Security (Inbound & Outbound)
- **Source Code**: [razorpay.webhook.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/modules/webhooks/razorpay.webhook.js), [webhook.worker.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/webhook.worker.js)

#### 1. Inbound Webhooks (From Razorpay to Gateway)
- Express JSON parser preserves the unparsed byte string buffer in `req.rawBody`.
- Middleware computes:
  $$\text{Expected Signature} = \text{HMAC-SHA256}(\text{req.rawBody}, \text{RAZORPAY\_WEBHOOK\_SECRET})$$
- If `expectedSignature !== req.headers["x-razorpay-signature"]`, the request is rejected with `400 Bad Request`.

#### 2. Outbound Webhooks (From Gateway to Merchants)
- Whenever a payment succeeds, fails, or refunds, a job is pushed to BullMQ's `webhookQueue`.
- The Webhook Worker generates an HMAC signature using the merchant's private `webhookSecret`:
  ```javascript
  const signature = crypto
    .createHmac("sha256", merchant.webhookSecret)
    .update(JSON.stringify(payload))
    .digest("hex");
  ```
- Posts to `merchant.webhookUrl` with headers:
  - `x-signature: sha256=<signature>`
  - `x-event: payment.succeeded`
- Delivery attempts, status codes, and latency are recorded in `webhookdeliveries` for audit logging. If the merchant server fails, BullMQ retries up to 5 times.

---

### Pillar 8: Full-Stack Observability & Telemetry (Prometheus & Grafana)
- **Source Code**: [metrics.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/config/metrics.js), [docker-compose.yml](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/docker-compose.yml), [prometheus.yaml](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/monitoring/prometheus/prometheus.yaml), [payment_engine.json](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/monitoring/grafana/provisioning/dashboards/definitions/payment_engine.json)

In distributed, event-driven payment pipelines, failures are often asynchronous and invisible to client-facing HTTP response codes. An Outbox relay might stall, BullMQ workers might back up under load, or upstream payment gateway response times might degrade without throwing explicit 500 errors. 

To guarantee production visibility, the engine integrates an autonomous, pull-based telemetry stack:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CORE TELEMETRY PIPELINE                         │
│                                                                        │
│   [HTTP Gateway Ingress]  ──► httpRequestDuration Histogram            │
│   [Payments Worker]       ──► paymentCounter (status, currency)        │
│   [Refunds Worker]        ──► refundCounter (status)                   │
│   [Webhooks Worker]       ──► webhookCounter (status)                  │
│   [Outbox Relay Poller]   ──► outboxLagGauge (pending count)           │
│   [BullMQ Engine]         ──► queueJobGauge (waiting/active/delayed)   │
│   [Node.js V8 Engine]     ──► collectDefaultMetrics (heap/CPU/lag)     │
│                                           │                            │
│                                           ▼                            │
│                         ┌───────────────────────────────────┐          │
│                         │  GET /metrics (prom-client Reg)   │          │
│                         └─────────────────┬─────────────────┘          │
└───────────────────────────────────────────┼────────────────────────────┘
                                            │ Scrapes every 15s
                                            ▼
                              ┌───────────────────────────┐
                              │ Prometheus Server (v2.51) │
                              └─────────────┬─────────────┘
                                            │ PromQL Query
                                            ▼
                              ┌───────────────────────────┐
                              │ Grafana Dashboard (v10.4) │
                              │ ("⚡ Payment Gateway")     │
                              └───────────────────────────┘
```

#### Telemetry Components & Guarantees:
1. **Dynamic BullMQ Scraping (`updateQueueMetrics`)**:
   Instead of running CPU-intensive polling loops for queue depths, BullMQ job statistics (`waiting`, `active`, `completed`, `failed`, `delayed`) across `payment-process`, `refund-processing-queue`, and `webhook-delivery` are queried atomically right when Prometheus initiates a `/metrics` scrape.
2. **Outbox Relay Lag Monitoring**:
   Every 1.5s outbox polling cycle sets `payment_gw_outbox_pending_events`. In Grafana, this gauge is mapped to color thresholds: **Green (0-4)**, **Yellow (5-19)**, and **Red (≥20)**, signaling an immediate operational alert if worker dispatch stalls.
3. **High-Resolution Latency Profiling**:
   The HTTP duration histogram partitions requests into sub-100ms buckets (`0.05, 0.1, 0.25, 0.5, 1, 2.5, 5` seconds). This enables exact PromQL calculations of P50, P95, and P99 latencies without degrading API performance. Scrapes to `/metrics` and `/health` are filtered out to avoid polluting latency graphs.
4. **Zero-Configuration Provisioning**:
   The `docker-compose.yml` mounts provisioning YAML files into Grafana container directories. Prometheus datasources and the comprehensive 7-panel visual dashboard load automatically on startup without requiring manual UI configuration.

---

### Pillar 9: Production Resilience, Graceful Shutdown & Centralized Error Architecture
- **Source Code**: [app.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/app.js), [error.middleware.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/middleware/error.middleware.js)

#### 1. Graceful Shutdown & Signal Trapping
In distributed cloud container environments (e.g., Docker, Kubernetes rolling updates, PM2), abrupt container termination causes dropped HTTP connections, lost Redis locks, and orphaned database transactions.

The gateway binds process listeners for `SIGTERM` and `SIGINT` to enforce a strict 4-step teardown protocol:

```
[Received SIGTERM / SIGINT]
           │
           ▼
1. server.close() ─────────────────► Rejects new HTTP requests; finishes active in-flight requests
           │
           ▼
2. Clear Polling Timers ──────────► Cancels outboxTimer (1.5s) & reconciliationTimer (60s)
           │
           ▼
3. Close MongoDB Connection ──────► mongoose.connection.close(false) flushes pending writes
           │
           ▼
4. Close Redis Client ────────────► redisClient.quit() gracefully unlinks connection & exits (0)
```

#### 2. Centralized Express 5 Error Architecture
With Express 5, all rejected promises in route controllers propagate directly to the global error middleware without requiring wrapping `try/catch` or `express-async-errors`:
- **Schema Validation Errors (`ValidationError`)**: Formats Mongoose schema rejections into `{ error: "Validation Error", details: [...] }` with HTTP 400.
- **Type Casting Errors (`CastError`)**: Traps invalid MongoDB ObjectIds (e.g. malformed `paymentId`) with `{ error: "Invalid format for field: <path>" }` (HTTP 400).
- **Malformed JSON Payloads**: Intercepts `SyntaxError` from Express `express.json()` parser and returns `{ error: "Malformed JSON in request body" }` (HTTP 400) instead of raw server crashes.
- **Production Information Masking**: In `NODE_ENV === "production"`, unhandled 500 exceptions return `{ error: "Internal Server Error" }` to prevent database and path leaks, while Winston logs the full stack trace to disk for debugging.
- **Uniform 404 Handler (`notFoundHandler`)**: Unmatched routes return `{ error: "Route not found: METHOD /path" }` with HTTP 404.

---

## 4. End-to-End Execution Sequence Diagrams

### Flow 1: Payment Ingestion & Fast API Return

```mermaid
sequenceDiagram
    autonumber
    actor Merchant as Merchant System
    participant GW as Gateway API (/v1/payments)
    participant Redis as Redis (Auth & Idempotency)
    participant Mongo as MongoDB

    Merchant->>GW: POST /v1/payments (Headers: x-api-key, Idempotency-Key)
    GW->>Redis: Check auth:merchant:<hash> (TTL 300s)
    alt Cache Hit
        Redis-->>GW: Merchant Profile
    else Cache Miss
        GW->>Mongo: Find Merchant by apiKeyHash
        Mongo-->>GW: Merchant Profile
        GW->>Redis: Cache Merchant Profile
    end

    GW->>Redis: SET idempotency:<id>:<key> {"state":"PROCESSING"} EX 120 NX
    alt Lock Failed (Key exists)
        GW->>Redis: GET idempotency:<id>:<key>
        alt State == PROCESSING
            GW-->>Merchant: 409 Conflict ("Request in-flight")
        else State == COMPLETED
            GW-->>Merchant: 201 Replay Cached Body (x-idempotent-replay: true)
        end
    else Lock Acquired
        GW->>Mongo: Create Payment (status: "CREATED")
        GW->>Mongo: Create OutboxEvent (eventType: "PAYMENT_CREATED", status: "PENDING")
        GW->>Redis: SET idempotency:<id>:<key> {"state":"COMPLETED", body} EX 86400
        GW-->>Merchant: 201 Created (paymentId, amount, status: "CREATED") [SLA: <50ms]
    end
```

---

### Flow 2: Outbox Polling & Upstream Order Creation

```mermaid
sequenceDiagram
    autonumber
    participant Relay as Outbox Relay (1.5s Interval)
    participant Mongo as MongoDB
    participant BullMQ as BullMQ (paymentQueue)
    participant Worker as Payment Worker
    participant Razorpay as Razorpay API

    Relay->>Mongo: Find OutboxEvents (status: "PENDING", limit: 20)
    Mongo-->>Relay: [OutboxEvent]
    Relay->>BullMQ: Add job (jobId: pay_<paymentId>)
    Relay->>Mongo: Update OutboxEvent (status: "PROCESSED")

    BullMQ->>Worker: Consume job: process-payment
    Worker->>Mongo: Atomic claim: status "CREATED" -> "PROCESSING"
    alt Already claimed
        Worker-->>BullMQ: Skip duplicate execution
    else Claim Successful
        Worker->>Razorpay: orders.create({ amount, currency, receipt: paymentId })
        alt Razorpay Success
            Razorpay-->>Worker: { id: "order_xyz123" }
            Worker->>Mongo: Save razorpayOrderId & clear processingLock
            Worker-->>BullMQ: Job Completed
        else Razorpay Error / Timeout
            Worker->>Mongo: Reset status: "CREATED"
            Worker-->>BullMQ: Throw Error (Triggers Exponential Backoff)
        end
    end
```

---

### Flow 3: Customer Checkout & Cryptographic Signature Verification

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer Browser
    participant CheckoutAPI as Gateway API (/v1/checkout)
    participant RazorpayModal as Razorpay Checkout SDK
    participant Mongo as MongoDB
    participant Ledger as Ledger Service

    Customer->>CheckoutAPI: GET /v1/checkout/:paymentId
    CheckoutAPI->>Mongo: Fetch Payment details
    CheckoutAPI-->>Customer: Sanitized metadata (orderId, keyId, amount)

    Customer->>RazorpayModal: Authorize Card / UPI
    RazorpayModal-->>Customer: Returns { razorpayPaymentId, razorpaySignature }

    Customer->>CheckoutAPI: POST /v1/checkout/verify
    CheckoutAPI->>CheckoutAPI: Verify HMAC-SHA256 (orderId + "|" + paymentId)
    alt Invalid Signature
        CheckoutAPI-->>Customer: 400 Bad Request ("Signature verification failed")
    else Signature Valid
        CheckoutAPI->>Mongo: Update Payment (status: "SUCCEEDED", razorpayPaymentId)
        CheckoutAPI->>Ledger: recordCredit(merchantId, paymentId, amount)
        Ledger->>Mongo: Insert LedgerEntry (type: "CREDIT")
        CheckoutAPI-->>Customer: 200 OK (status: "SUCCEEDED")
    end
```

---

### Flow 4: Inbound Webhook Processing

```mermaid
sequenceDiagram
    autonumber
    actor RazorpayServer as Razorpay Webhook Dispatcher
    participant WebhookRoute as Gateway API (/v1/webhooks/razorpay)
    participant Mongo as MongoDB
    participant Ledger as Ledger Service
    participant Queue as BullMQ (webhookQueue)

    RazorpayServer->>WebhookRoute: POST /v1/webhooks/razorpay (Headers: x-razorpay-signature)
    WebhookRoute->>WebhookRoute: HMAC-SHA256(req.rawBody, RAZORPAY_WEBHOOK_SECRET)
    alt Signature Mismatch
        WebhookRoute-->>RazorpayServer: 400 Bad Request
    else Signature Verified
        alt Event == "payment.captured" or "order.paid"
            WebhookRoute->>Mongo: Find Payment by razorpayOrderId
            opt If status != "SUCCEEDED"
                WebhookRoute->>Mongo: Update status: "SUCCEEDED"
                WebhookRoute->>Ledger: recordCredit(merchantId, paymentId, amount)
                Ledger->>Mongo: Insert LedgerEntry (type: "CREDIT")
                WebhookRoute->>Queue: Enqueue merchant notification (payment.succeeded)
            end
        else Event == "payment.failed"
            WebhookRoute->>Mongo: Update status: "FAILED"
            WebhookRoute->>Queue: Enqueue merchant notification (payment.failed)
        end
        WebhookRoute-->>RazorpayServer: 200 OK ({ status: "ok" })
    end
```

---

### Flow 5: Partial / Full Refund Lifecycle with Saga Rollback

```mermaid
sequenceDiagram
    autonumber
    actor Merchant as Merchant System
    participant GW as Gateway API (/v1/refunds)
    participant Mongo as MongoDB
    participant BullMQ as BullMQ (refundQueue)
    participant Worker as Refund Worker
    participant Razorpay as Razorpay API
    participant Ledger as Ledger Service

    Merchant->>GW: POST /v1/refunds (paymentId, amount, Idempotency-Key)
    GW->>Mongo: Verify Payment is SUCCEEDED and amount <= remaining
    GW->>Mongo: Pre-reserve: payment.refundedAmount += amount
    GW->>Mongo: Create Refund (status: "PENDING")
    GW->>BullMQ: Enqueue job: process-refund
    GW-->>Merchant: 202 Accepted ({ refundId, status: "PENDING" })

    BullMQ->>Worker: Consume refund job
    Worker->>Mongo: Claim refund (PENDING -> PROCESSING)
    Worker->>Razorpay: payments.refund(processorPaymentId, { amount })
    alt Refund Succeeded
        Razorpay-->>Worker: { id: "rfnd_abc", status: "processed" }
        Worker->>Mongo: Update Refund (status: "SUCCEEDED", processorRefundId)
        Worker->>Ledger: recordDebit(merchantId, paymentId, refundId, amount)
        Ledger->>Mongo: Insert LedgerEntry (type: "DEBIT")
        Worker-->>BullMQ: Job Completed
    else Permanent Failure (Exhausted 5 attempts)
        Razorpay-->>Worker: Error (Bank rejection / expired card)
        Worker->>Mongo: Compensating Rollback: payment.refundedAmount -= amount
        Worker->>Mongo: Update Refund (status: "FAILED", failureReason)
        Worker-->>BullMQ: Terminal Failure Acknowledged
    end
```

---

### Flow 6: Autonomous Reconciliation Sweep

```mermaid
sequenceDiagram
    autonumber
    participant Sweeper as Reconciliation Worker (Runs every 60s)
    participant Mongo as MongoDB
    participant Razorpay as Razorpay API
    participant Ledger as Ledger Service
    participant Queue as BullMQ (webhookQueue)

    loop Every 60 seconds
        Sweeper->>Mongo: Query payments (status: "PROCESSING", updatedAt < Now - 3m)
        Mongo-->>Sweeper: [Stuck Payment Documents]
        loop For each stuck payment
            Sweeper->>Razorpay: fetchOrderPayments(razorpayOrderId)
            Razorpay-->>Sweeper: { items: [ { id: "pay_123", status: "captured" } ] }
            alt Captured payment found
                Sweeper->>Mongo: Update Payment (status: "SUCCEEDED", razorpayPaymentId: "pay_123")
                Sweeper->>Ledger: recordCredit(merchantId, paymentId, amount)
                Ledger->>Mongo: Insert LedgerEntry (type: "CREDIT")
                Sweeper->>Queue: Enqueue merchant webhook (payment.succeeded)
            else No capture & payment window expired (>10m)
                Sweeper->>Mongo: Update Payment (status: "FAILED")
                Sweeper->>Queue: Enqueue merchant webhook (payment.failed)
            end
        end
    end
```

---

### Flow 7: Outbound Webhook Delivery with Exponential Backoff

```mermaid
sequenceDiagram
    autonumber
    participant Queue as BullMQ (webhookQueue)
    participant Worker as Webhook Worker
    participant Mongo as MongoDB
    actor MerchantServer as Merchant Webhook Endpoint

    Queue->>Worker: Consume job: dispatch-webhook
    Worker->>Mongo: Fetch Merchant webhookUrl & webhookSecret
    Worker->>Worker: Compute HMAC-SHA256 signature
    Worker->>MerchantServer: POST webhookUrl (Headers: x-signature, x-event)
    alt Merchant responds HTTP 2xx
        MerchantServer-->>Worker: 200 OK
        Worker->>Mongo: Insert WebhookDelivery (status: "SUCCESS", responseStatus: 200)
        Worker-->>Queue: Job Completed
    else Merchant returns 5xx or Connection Times Out (5s)
        MerchantServer-->>Worker: Error / Timeout
        Worker->>Mongo: Insert WebhookDelivery (status: "FAILED", attemptNumber)
        Worker-->>Queue: Throw error (BullMQ retries with Exponential Backoff, max 5)
    end
```

---

### Flow 8: Prometheus Telemetry Scraping & Grafana Dashboard Rendering

```mermaid
sequenceDiagram
    autonumber
    participant Prom as Prometheus (Scrapes every 15s)
    participant GW as Gateway API (/metrics)
    participant Metrics as Metrics Registry (prom-client)
    participant BullMQ as BullMQ Queues (payment/refund/webhook)
    participant Grafana as Grafana Dashboard (:3001)

    Prom->>GW: GET /metrics (HTTP scrape request)
    GW->>Metrics: updateQueueMetrics()
    Metrics->>BullMQ: getJobCounts("waiting", "active", "completed", "failed", "delayed")
    BullMQ-->>Metrics: Return real-time job counts
    Metrics->>Metrics: queueJobGauge.set({ queue, status }, count)
    Metrics-->>GW: Rendered Prometheus metric vector text
    GW-->>Prom: HTTP 200 OK (Content-Type: text/plain; version=0.0.4)
    Grafana->>Prom: PromQL Query (e.g. rate(payment_gw_http_request_duration_seconds_sum[1m]))
    Prom-->>Grafana: Time-series query result
    Grafana->>Grafana: Render real-time visual charts & status panels
```

---

## 5. State Machines & Entity Lifecycles

### Payment State Machine

```mermaid
stateDiagram-v2
    [*] --> CREATED: Ingested via POST /v1/payments (Outbox written)
    CREATED --> PROCESSING: Claimed by payment.worker.js (Order created in Razorpay)
    PROCESSING --> SUCCEEDED: Customer completes checkout OR Inbound webhook captures OR Reconciliation heals
    PROCESSING --> FAILED: Checkout window expires (>10m) OR Processor rejects
    CREATED --> CANCELLED: Explicit cancellation
    SUCCEEDED --> [*]
    FAILED --> [*]
    CANCELLED --> [*]

    state SUCCEEDED {
        [*] --> NONE: refundedAmount == 0
        NONE --> PARTIAL: 0 < refundedAmount < totalAmount
        PARTIAL --> FULL: refundedAmount == totalAmount
    }
```

### Refund State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING: Ingested via POST /v1/refunds (Amount reserved on payment)
    PENDING --> PROCESSING: Claimed by refund.worker.js
    PROCESSING --> SUCCEEDED: Razorpay accepts refund (Ledger DEBIT recorded)
    PROCESSING --> FAILED: Upstream failure after 5 retries (Amount rolled back to payment)
    SUCCEEDED --> [*]
    FAILED --> [*]
```

---

## 6. Distributed Failure Modes & Disaster Recovery Matrix

| # | Failure Scenario | Exact Root Cause | Immediate Defense Mechanism | Recovery & Eventual Consistency |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **User double-clicks "Pay"** | Latency hesitation or mobile retry | Redis atomic `SET NX` lock on `idempotency:<id>:<key>` | Returns HTTP `409 Conflict` if in-flight; returns cached HTTP `201` if already finished. |
| **2** | **Server crashes during payment write** | Power outage or container restart | Atomic MongoDB session write | MongoDB commits either both `Payment` and `OutboxEvent` or neither. No partial writes. |
| **3** | **Worker crashes while creating order** | Out of memory (OOM) or SIGKILL | Atomic document claim lock | BullMQ detects worker stall. `processingLock` timestamps allow lock reassignment. |
| **4** | **Customer drops internet after paying** | User closes browser on success screen | Reconciliation Sweeper | Sweeper queries Razorpay after 3 minutes, detects captured status, and records ledger credit. |
| **5** | **Merchant webhook endpoint crashes** | Merchant server maintenance (500/503) | BullMQ exponential backoff | Retries delivery 5 times: 3s, 6s, 12s, 24s, 48s. Every attempt is logged in MongoDB. |
| **6** | **Bug attempts to mutate past ledger entry** | Unauthorized code or database mutation | Mongoose pre-hook guard | Schema hooks intercept `updateOne`, `deleteMany`, etc., throwing `LEDGER_IMMUTABILITY_VIOLATION`. |
| **7** | **Processor rejects partial refund** | Card expired or bank account closed | Compensating Saga Rollback | Worker catches terminal failure, decrements `payment.refundedAmount`, and restores refundable balance. |
| **8** | **Redis restarts unexpectedly** | Redis memory flush or container reboot | MongoDB Source-of-Truth | BullMQ reconnects automatically. Outbox relay re-polls any pending events from MongoDB. |
| **9** | **Worker backlog / Outbox relay stall** | Network partition or excessive burst traffic | Prometheus gauges & Grafana threshold alert | `payment_gw_outbox_pending_events` triggers red alert (≥20); workers auto-recover upon re-establishing connection. |
| **10** | **Container termination / Rolling deploy** | SIGTERM from Docker/Kubernetes/PM2 | Graceful Shutdown sequence in `app.js` | Stops accepting new HTTP connections, cancels background intervals, and cleanly drains DB and Redis connections. |

---

## 7. Codebase Reference Map

Direct clickable links to implementation files in the repository:

| Functional Area | Source Code Link | Primary Role |
| :--- | :--- | :--- |
| **Server Entrypoint** | [app.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/app.js) | Express 5 setup, graceful shutdown signal trapping, and route mounting |
| **Metrics Registry** | [metrics.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/config/metrics.js) | prom-client counters, gauges, histograms, and dynamic BullMQ scraper |
| **Centralized Error Middleware** | [error.middleware.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/middleware/error.middleware.js) | Mongoose validation, CastError, malformed JSON, and 404 interceptor |
| **Redis Singleton** | [redis.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/config/redis.js) | ioredis client configuration and connection event listeners |
| **Database Connection** | [db.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/config/db.js) | Mongoose replica set connection handler |
| **API Authentication** | [auth.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/middleware/auth.js) | `x-api-key` SHA-256 hashing and Redis caching (TTL 300s) |
| **Distributed Idempotency** | [idempotency.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/middleware/idempotency.js) | Atomic `SET NX` locks and 24-hour response replay |
| **Payment Ingestion** | [payment.controller.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/modules/payments/payment.controller.js) | Validates input, saves payment + outbox event (< 50ms response) |
| **Outbox Relay** | [outbox.relay.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/outbox.relay.js) | Polls pending outbox records every 1.5s, updates lag gauge, enqueues to BullMQ |
| **Payment Worker** | [payment.worker.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/payment.worker.js) | Claims jobs atomically, invokes Razorpay SDK, updates order ID |
| **Double-Entry Ledger Model** | [ledger.model.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/modules/ledger/ledger.model.js) | Blocks updates & deletes with `LEDGER_IMMUTABILITY_VIOLATION` |
| **Dynamic Balance Service** | [ledger.service.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/modules/ledger/ledger.service.js) | Aggregation pipeline calculating `SUM(Credits) - SUM(Debits)` |
| **Refund Engine & Saga** | [refund.worker.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/refund.worker.js) | Pre-reserves balance, invokes processor, handles compensating rollback |
| **Reconciliation Sweeper** | [reconciliation.worker.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/reconciliation.worker.js) | Sweeps stuck payments older than 3 minutes every 60 seconds |
| **Webhook Delivery Worker** | [webhook.worker.js](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/src/workers/webhook.worker.js) | Signs HMAC-SHA256 headers and executes HTTP POST with retries |
| **Hosted Checkout Portal** | [CheckoutPage.jsx](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/frontend/src/pages/CheckoutPage.jsx) | Customer interface triggering the Razorpay Checkout Modal |
| **Prometheus Scrape Config** | [prometheus.yaml](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/monitoring/prometheus/prometheus.yaml) | 15s scrape interval config targeting `backend:3000` |
| **Grafana Dashboard JSON** | [payment_engine.json](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/monitoring/grafana/provisioning/dashboards/definitions/payment_engine.json) | 7-panel Grafana dashboard definition for engine metrics |
| **Multi-Service Compose** | [docker-compose.yml](file:///d:/Backend/Backend%20Projects/Event-Driven%20Payment%20Gateway%20&%20Ledger%20Engine/backend/docker-compose.yml) | Orchestrates Mongo RS, Redis, Backend, Prometheus, and Grafana |


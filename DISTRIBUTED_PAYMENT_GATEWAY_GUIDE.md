# Distributed Payment Gateway Guide

This guide explains how to build an intermediate distributed payment gateway as a backend project. The goal is to learn scalable backend architecture without making the system too complex or over-engineered.

You are not building a real bank-grade payment network. You are building a realistic learning project that demonstrates the important ideas behind modern payment systems: reliable APIs, idempotency, async processing, transaction state, retries, reconciliation, observability, and safe database design.

## 1. Project Goal

Build a backend system where merchants can:

- Create a payment request.
- Redirect or submit payment details.
- Process payment through upstream Razorpay Orders & Payments API.
- Receive final payment status.
- Query payment history.
- Receive webhook notifications.
- Handle duplicate requests safely.
- Recover from temporary failures via Razorpay Reconciliation.

The system is a production-grade distributed payment gateway backend using Razorpay as the upstream processor.

## 2. What You Should Build

For this system, build these components:

1. API Gateway
2. Authentication service or auth middleware
3. Merchant service
4. Payment service
5. Ledger service
6. Notification/Webhook service (Incoming Razorpay Webhook + Outgoing Merchant Webhooks)
7. Razorpay Processor service (`razorpay.processor.js`)
8. Message queue (BullMQ on Redis)
9. Database (MongoDB Replica Set)
10. Background workers (Outbox Relay, Payment Worker, Webhook Worker, Reconciliation Worker)
11. Observability setup

You can implement these as separate services or as a modular monolith first. For learning, a modular monolith with clear module boundaries is usually better than starting with many tiny services.

Recommended architecture:

```text
Client / Merchant
      |
      v
API Gateway / Backend API
      |
      +--> Auth Module
      +--> Merchant Module
      +--> Payment Module
      +--> Ledger Module
      +--> Webhook Module (Incoming Razorpay + Outgoing Merchant)
      |
      v
BullMQ Queues (Redis)
      |
      +--> Outbox Relay
      +--> Payment Worker
      +--> Webhook Worker
      +--> Reconciliation Worker
      |
      v
Upstream Razorpay API (Orders, Payments, Webhooks)
```

Start with one backend application and split it later only if you actually need to.

## 3. Core Concepts You Must Understand

### Payment Intent

A payment intent represents the merchant's request to collect money.

Example:

```text
Merchant wants to charge customer 1000 INR.
System creates a payment_intent with status CREATED.
Payment processing starts.
Final status becomes SUCCEEDED, FAILED, or CANCELLED.
```

The payment intent is the source of truth for payment lifecycle.

### Idempotency

Payment APIs must safely handle duplicate requests.

If a merchant sends the same `POST /payments` request twice because of a timeout, your system must not charge the customer twice.

Use an `Idempotency-Key` header.

Example:

```http
POST /payments
Idempotency-Key: order_123_payment_attempt_1
```

Store the key with:

- Merchant ID
- Request hash
- Response body
- Payment ID
- Expiry time

If the same key is received again, return the original response instead of creating a new payment.

### Async Processing

Payment processing should not fully happen inside the API request.

The API should:

1. Validate request.
2. Create payment record.
3. Save outbox/event record.
4. Return `202 Accepted` or initial payment status.
5. Let a worker process the payment in the background.

This makes the system more reliable and scalable.

### Payment State Machine

Payments should move through controlled states.

Recommended states:

```text
CREATED
PROCESSING
REQUIRES_ACTION
SUCCEEDED
FAILED
CANCELLED
```

Allowed transitions:

```text
CREATED -> PROCESSING
PROCESSING -> SUCCEEDED
PROCESSING -> FAILED
PROCESSING -> REQUIRES_ACTION
REQUIRES_ACTION -> PROCESSING
REQUIRES_ACTION -> CANCELLED
```

Do not allow random status updates. A payment should not go from `FAILED` back to `SUCCEEDED` unless you explicitly model retries as a new attempt.

### Ledger

The ledger records money movement. It should be append-only.

Do not update old ledger entries. Add new entries.

Example ledger entries:

```text
Payment succeeded:
- Debit customer clearing account
- Credit merchant pending balance

Settlement:
- Debit merchant pending balance
- Credit merchant available balance
```

For the intermediate version, keep the ledger simple:

- Record one credit entry for merchant when payment succeeds.
- Record one debit entry if refund is added later.
- Never delete ledger records.

## 4. Recommended Tech Stack

Use what you already know, but this stack is practical:

- Backend: Node.js/NestJS, Java/Spring Boot, Go, or Python/FastAPI
- Database: MongoDB
- Cache & Queue Engine: Redis
- Queue: BullMQ (Redis-backed queue with built-in retries and concurrency)
- API style: REST
- Containerization: Docker Compose
- Observability: Prometheus + Grafana or simple structured logs first

For an intermediate project, MongoDB + Redis + BullMQ is enough. Using BullMQ means your Redis instance handles both caching and background job queues without needing a separate message broker like RabbitMQ.

If you use MongoDB multi-document transactions, run MongoDB as a single-node replica set in Docker Compose even for local development.

Avoid starting with Kubernetes unless you specifically want to learn deployment infrastructure. Docker Compose is enough for this project.

## 5. Main Services and Responsibilities

### API Gateway / Backend API

Responsibilities:

- Accept merchant API requests.
- Authenticate merchant.
- Validate request body.
- Enforce rate limits.
- Forward request to internal modules.
- Return consistent API responses.

Example endpoints:

```http
POST /v1/payments
GET /v1/payments/{payment_id}
POST /v1/payments/{payment_id}/cancel
POST /v1/refunds
GET /v1/merchants/{merchant_id}/balance
```

### Auth Module

Responsibilities:

- Store merchant API keys.
- Validate API key on every request.
- Attach merchant context to request.

For this project, API key authentication is enough.

Example:

```http
Authorization: Bearer merchant_api_key
```

Store only hashed API keys in the database.

### Merchant Module

Responsibilities:

- Create merchant accounts.
- Store merchant configuration.
- Store webhook URL.
- Store supported currency settings.

Keep it simple:

- One merchant can create many payments.
- Each merchant has one webhook URL.
- Each merchant has one API key.

### Payment Module

Responsibilities:

- Create payment intents.
- Enforce idempotency.
- Maintain payment status.
- Create payment attempts.
- Publish processing events.
- Store processor response.

Important collections:

- `payments`
- `payment_attempts`
- `idempotency_keys`
- `outbox_events`

### Razorpay Processor Service

Responsibilities:

- Interface with Razorpay's official Node.js SDK (`razorpay`).
- Create upstream Razorpay Orders (`razorpay.orders.create`) using the merchant's payment intent amount and currency.
- Store `razorpay_order_id` on the Payment record.
- Verify payment signatures (`razorpay_signature`) via HMAC-SHA256 upon checkout completion.
- Fetch status of orders and payments for active reconciliation.

This provides a real, production-ready payment flow connected to an actual financial acquirer.

### Ledger Module

Responsibilities:

- Create ledger entries when payment succeeds.
- Track merchant balance.
- Keep money movement auditable.

Do not mix payment status and ledger balance in the same collection.

### Webhook Module

Responsibilities:

- Send events to merchant webhook URL.
- Retry failed webhook deliveries.
- Sign webhook payloads.
- Store delivery attempts.

Example webhook event:

```json
{
  "event_id": "evt_123",
  "type": "payment.succeeded",
  "payment_id": "pay_123",
  "amount": 1000,
  "currency": "INR"
}
```

Sign webhooks using HMAC:

```text
signature = HMAC_SHA256(webhook_secret, raw_payload)
```

## 6. MongoDB Data Model

Use separate collections for the main domain objects. MongoDB is flexible, but for a payment gateway you should still model data carefully and create indexes intentionally.

Use string IDs such as `pay_123`, `mer_123`, and `evt_123` if you want readable API IDs. Internally, you can also use MongoDB `_id` values.

### merchants

```json
{
  "_id": "mer_123",
  "name": "Demo Merchant",
  "api_key_hash": "...",
  "webhook_url": "https://merchant.example.com/webhooks",
  "webhook_secret": "...",
  "status": "ACTIVE",
  "created_at": "2026-10-10T10:00:00Z",
  "updated_at": "2026-10-10T10:00:00Z"
}
```

### payments

```json
{
  "_id": "pay_123",
  "merchant_id": "mer_123",
  "amount": 1000,
  "currency": "INR",
  "status": "CREATED",
  "description": "Order #123",
  "metadata": {
    "order_id": "123"
  },
  "processor_payment_id": null,
  "processing_lock": null,
  "created_at": "2026-10-10T10:00:00Z",
  "updated_at": "2026-10-10T10:00:00Z"
}
```

### payment_attempts

```json
{
  "_id": "pat_123",
  "payment_id": "pay_123",
  "processor_name": "mock_processor",
  "status": "PROCESSING",
  "request_payload": {},
  "response_payload": null,
  "failure_code": null,
  "failure_message": null,
  "started_at": "2026-10-10T10:00:01Z",
  "finished_at": null,
  "created_at": "2026-10-10T10:00:01Z"
}
```

### idempotency_keys

```json
{
  "_id": "idem_123",
  "merchant_id": "mer_123",
  "idempotency_key": "order_123_attempt_1",
  "request_hash": "...",
  "response_status": 200,
  "response_body": {
    "id": "pay_123",
    "status": "CREATED"
  },
  "created_at": "2026-10-10T10:00:00Z",
  "expires_at": "2026-10-11T10:00:00Z"
}
```

Add a unique compound index:

```javascript
db.idempotency_keys.createIndex(
  { merchant_id: 1, idempotency_key: 1 },
  { unique: true }
);
```

### ledger_entries

```json
{
  "_id": "led_123",
  "merchant_id": "mer_123",
  "payment_id": "pay_123",
  "entry_type": "PAYMENT_CAPTURED",
  "amount": 1000,
  "currency": "INR",
  "direction": "CREDIT",
  "created_at": "2026-10-10T10:00:03Z"
}
```

Example values:

```text
entry_type = PAYMENT_CAPTURED
direction = CREDIT
```

### outbox_events

```json
{
  "_id": "out_123",
  "event_type": "PaymentCreated",
  "aggregate_type": "payment",
  "aggregate_id": "pay_123",
  "payload": {
    "payment_id": "pay_123"
  },
  "status": "PENDING",
  "retry_count": 0,
  "next_retry_at": "2026-10-10T10:00:00Z",
  "created_at": "2026-10-10T10:00:00Z",
  "processed_at": null
}
```

### webhook_deliveries

```json
{
  "_id": "whd_123",
  "merchant_id": "mer_123",
  "event_id": "evt_123",
  "webhook_url": "https://merchant.example.com/webhooks",
  "payload": {},
  "status": "PENDING",
  "response_status": null,
  "response_body": null,
  "attempt_count": 0,
  "next_retry_at": "2026-10-10T10:00:00Z",
  "created_at": "2026-10-10T10:00:00Z",
  "updated_at": "2026-10-10T10:00:00Z"
}
```

## 7. Payment Flow

### Step 1: Merchant Creates Payment

Request:

```http
POST /v1/payments
Authorization: Bearer merchant_api_key
Idempotency-Key: order_123_attempt_1
Content-Type: application/json
```

```json
{
  "amount": 1000,
  "currency": "INR",
  "description": "Order #123",
  "metadata": {
    "order_id": "123"
  }
}
```

Backend flow:

```text
1. Authenticate merchant.
2. Validate amount and currency.
3. Check idempotency key.
4. Create payment with status CREATED.
5. Create outbox event PaymentCreated.
6. Store idempotency response.
7. Return payment response.
```

Response:

```json
{
  "id": "pay_123",
  "status": "CREATED",
  "amount": 1000,
  "currency": "INR"
}
```

### Step 2: Worker Processes Payment

Worker flow:

```text
1. Read PaymentCreated event.
2. Claim the payment using an atomic MongoDB update.
3. Change status to PROCESSING.
4. Create payment attempt.
5. Call mock processor.
6. Update payment attempt.
7. Update payment status.
8. If successful, create ledger entry.
9. Create webhook event.
```

### Step 3: Merchant Receives Webhook

Webhook worker sends:

```json
{
  "id": "evt_123",
  "type": "payment.succeeded",
  "created_at": "2026-10-10T10:00:00Z",
  "data": {
    "payment_id": "pay_123",
    "status": "SUCCEEDED",
    "amount": 1000,
    "currency": "INR"
  }
}
```

If webhook delivery fails, retry with backoff:

```text
1 minute
5 minutes
15 minutes
1 hour
6 hours
```

Stop after a fixed number of attempts, such as 10.

## 8. Reliability Patterns

### Use MongoDB Transactions

When creating a payment:

```text
Start MongoDB session
Start transaction
Insert payment document
Insert outbox event document
Insert idempotency key document
Commit transaction
```

This ensures payment, event creation, and idempotency storage happen together.

For local development, MongoDB transactions require a replica set. A single-node replica set is enough for this project.

### Use the Outbox Pattern

Do not publish directly to a queue inside the same code path as database writes unless you can handle partial failure.

Better approach:

1. Write payment document.
2. Write outbox event document in the same transaction.
3. Separate worker reads outbox events.
4. Worker publishes to queue or processes event.
5. Mark event as processed.

This prevents losing events when the MongoDB write succeeds but queue publish fails.

### Use Atomic Claims for Payment Processing

MongoDB does not use relational `SELECT ... FOR UPDATE` locks. Instead, claim work with an atomic `findOneAndUpdate`.

```javascript
db.payments.findOneAndUpdate(
  {
    _id: "pay_123",
    status: "CREATED",
    processing_lock: null
  },
  {
    $set: {
      status: "PROCESSING",
      processing_lock: {
        worker_id: "worker_1",
        locked_at: new Date()
      },
      updated_at: new Date()
    }
  },
  { returnDocument: "after" }
);
```

This prevents two workers from processing the same payment at the same time.

### Retry Carefully

Retry only safe operations.

Good retry candidates:

- Network timeout to mock processor.
- Temporary database connection issue.
- Webhook delivery failure.

Bad retry candidates:

- Invalid card.
- Invalid merchant.
- Invalid amount.
- Already completed payment.

### Make External Calls Idempotent

When calling the mock processor, pass your payment attempt ID as an idempotency key.

That way, if your worker retries after a timeout, the processor can return the same result instead of creating a duplicate charge.

## 9. Scalability Design

Start simple, then scale specific bottlenecks.

### API Layer

You can run multiple API instances because they are stateless.

Store shared state in:

- MongoDB
- Redis (cache, distributed locks, BullMQ job queues)

### Workers

Workers can be scaled horizontally.

Example:

```text
3 payment workers
2 webhook workers
1 reconciliation worker
```

Use atomic document updates or queue visibility timeouts to avoid duplicate processing.

### Database

For the intermediate version:

- Use indexes properly.
- Keep transactions short.
- Use connection pooling.
- Archive old webhook delivery attempts later.

Useful indexes:

```javascript
db.payments.createIndex({ merchant_id: 1, created_at: -1 });
db.payments.createIndex({ status: 1, updated_at: 1 });
db.payment_attempts.createIndex({ payment_id: 1, created_at: -1 });
db.ledger_entries.createIndex({ merchant_id: 1, created_at: -1 });
db.outbox_events.createIndex({ status: 1, next_retry_at: 1 });
db.webhook_deliveries.createIndex({ status: 1, next_retry_at: 1 });
```

Do not start with database sharding. It is unnecessary for this project.

### Cache and Queue

Use Redis for:

- BullMQ job queues (`payment-queue`, `webhook-queue`, `reconciliation-queue`).
- Rate limiting.
- Short-lived merchant config cache.
- Distributed locks only if truly needed.

Do not use cache as the source of truth for payments.

## 10. Security Basics

Implement these:

- API key authentication.
- Hashed API keys in database.
- Request validation.
- HTTPS in production.
- HMAC-signed webhooks.
- No sensitive card data stored.
- Audit logs for important actions.
- Rate limiting per merchant.

Avoid storing real card data. Use fake card tokens in the mock processor.

Example:

```json
{
  "payment_method_token": "tok_test_success"
}
```

## 11. Observability

At minimum, add structured logs.

Every log should include:

- `request_id`
- `merchant_id`
- `payment_id`
- `event_id`
- `status`

Important metrics:

- Total payment requests
- Payment success rate
- Payment failure rate
- Processor latency
- Webhook delivery success rate
- Queue depth
- Worker retry count
- Database query latency

Important alerts:

- Payment success rate drops suddenly.
- Queue size keeps growing.
- Webhook failures increase.
- Processor timeout rate increases.

## 12. Reconciliation

Reconciliation means comparing your system's payment state with the processor's state.

Why it matters:

- Your worker may crash after processor success but before database update.
- Processor callback may be delayed.
- Network timeout may hide the actual result.

For this project, create a scheduled worker:

```text
Every 5 minutes:
1. Find payments stuck in PROCESSING for more than 10 minutes.
2. Ask mock processor for latest status.
3. Update payment status if needed.
4. Create ledger entry if payment succeeded.
5. Send webhook if final status changed.
```

This is one of the most valuable parts of the project because it teaches real distributed-system recovery.

## 13. API Design

### Create Payment

```http
POST /v1/payments
```

Request:

```json
{
  "amount": 1000,
  "currency": "INR",
  "description": "Order #123",
  "payment_method_token": "tok_test_success",
  "metadata": {
    "order_id": "123"
  }
}
```

Response:

```json
{
  "id": "pay_123",
  "status": "CREATED",
  "amount": 1000,
  "currency": "INR",
  "created_at": "2026-10-10T10:00:00Z"
}
```

### Get Payment

```http
GET /v1/payments/pay_123
```

Response:

```json
{
  "id": "pay_123",
  "status": "SUCCEEDED",
  "amount": 1000,
  "currency": "INR",
  "description": "Order #123",
  "metadata": {
    "order_id": "123"
  }
}
```

### Create Refund

Refunds can be phase 2.

```http
POST /v1/refunds
```

Request:

```json
{
  "payment_id": "pay_123",
  "amount": 500,
  "reason": "requested_by_customer"
}
```

Only allow refund if payment is `SUCCEEDED`.

## 14. Suggested Implementation Phases

### Phase 1: Basic Payment API

Build:

- Merchant collection
- API key auth
- Create payment API
- Get payment API
- MongoDB collections and indexes
- Basic validation

Skip queues for the first few days if needed. Make the payment status update synchronously with the mock processor, then refactor to async.

### Phase 2: Idempotency and State Machine

Build:

- Idempotency key collection
- Request hash validation
- Payment status transitions
- Duplicate request handling

This phase is essential.

### Phase 3: Async Processing

Build:

- Outbox collection
- Payment worker
- Message queue (BullMQ on Redis)
- Retry logic
- Payment attempts collection

Now the project starts feeling distributed.

### Phase 4: Ledger

Build:

- Ledger entries
- Merchant balance query
- Append-only money movement records

Keep it simple. Do not implement complex settlement yet.

### Phase 5: Webhooks

Build:

- Webhook event creation
- Webhook delivery worker
- HMAC signature
- Retry with backoff
- Webhook delivery logs

### Phase 6: Reconciliation

Build:

- Scheduled reconciliation worker
- Processor status lookup
- Recovery for stuck payments

### Phase 7: Observability and Load Testing

Build:

- Structured logs
- Basic metrics
- Request IDs
- Simple load test script

Test:

- Duplicate payment requests
- Worker crash
- Processor timeout
- Webhook failure
- High request volume

## 15. What Not To Build Yet

To keep the project intermediate, avoid these at first:

- Real card processing
- PCI compliance scope
- Multi-region deployment
- Database sharding
- Kubernetes
- Complex fraud detection
- Dynamic payment routing
- Multi-currency settlement
- Advanced chargeback handling
- Real bank integrations
- Event sourcing for everything
- Dozens of microservices

These are useful topics later, but they will slow down this project too early.

## 16. Folder Structure Example

For a modular monolith:

```text
src/
  app/
  modules/
    auth/
    merchants/
    payments/
    ledger/
    webhooks/
    processor/
    reconciliation/
  workers/
    payment-worker/
    webhook-worker/
    outbox-worker/
    reconciliation-worker/
  common/
    database/
    logger/
    errors/
    validation/
    config/
tests/
docker-compose.yml
README.md
```

If using Java/Spring Boot, use packages instead of folders with the same boundaries.

## 17. Important Edge Cases

Handle these:

- Same idempotency key with same request.
- Same idempotency key with different request.
- Payment worker crashes after processor success.
- Processor times out but later succeeds.
- Merchant webhook endpoint is down.
- User requests payment status while payment is processing.
- Two workers pick the same payment.
- Ledger entry creation fails after payment succeeds.
- Refund requested for failed payment.
- Amount is zero or negative.
- Unsupported currency.

## 18. Testing Strategy

Write tests for:

- Payment creation
- API key authentication
- Idempotency behavior
- Status transitions
- Worker retry logic
- Ledger entry creation
- Webhook signature generation
- Reconciliation of stuck payments

Recommended test types:

- Unit tests for state machine and validation.
- Integration tests for database operations.
- End-to-end tests for payment flow.
- Failure tests for timeout and retry behavior.

Example failure test:

```text
Given mock processor returns timeout
When payment worker retries
Then system should not create duplicate payment attempts incorrectly
And final payment status should eventually be resolved by reconciliation
```

## 19. Minimal Production-Like Checklist

Before calling the project complete:

- Payments are idempotent.
- Payment status transitions are controlled.
- Workers can retry safely.
- Duplicate processing is prevented.
- Ledger entries are append-only.
- Webhooks are signed and retried.
- Stuck payments are reconciled.
- Logs include request IDs and payment IDs.
- Database indexes exist for common queries.
- No real card data is stored.
- Docker Compose can start the full system.

## 20. Final Recommended Scope

Your final intermediate project should include:

- REST APIs for merchants.
- MongoDB-backed payment records.
- API key auth.
- Idempotency keys.
- Async payment processing.
- Mock external processor.
- Payment attempts.
- Ledger entries.
- Merchant balance.
- Webhook delivery with retries.
- Reconciliation worker.
- Docker Compose setup.
- Basic logs and metrics.

This is enough to demonstrate strong backend engineering skill without making the project unnecessarily complicated.

## 21. Best Learning Path

Build in this order:

1. MongoDB data model
2. Merchant auth
3. Create payment API
4. Get payment API
5. Mock processor
6. Idempotency
7. Payment worker
8. Outbox pattern
9. Ledger
10. Webhooks
11. Reconciliation
12. Observability
13. Load testing

The most important lesson is this: in payment systems, success is not only about making the happy path work. The real engineering is in handling duplicates, retries, timeouts, partial failures, and recovery in a way that never loses money or charges twice.

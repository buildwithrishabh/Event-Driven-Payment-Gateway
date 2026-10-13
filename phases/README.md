# Distributed Payment Gateway — Implementation Phases (Powered by Razorpay)

Welcome to the step-by-step implementation guide for building a production-grade Distributed Payment Gateway in Node.js (JavaScript) using **Razorpay** as the real upstream payment processor.

Each phase has its own dedicated guide with architecture, complete ready-to-use code, and verification steps. Follow them sequentially:

| Phase | Guide | Focus Area | Key Concepts |
| :--- | :--- | :--- | :--- |
| **Phase 1** | [PHASE_1_SETUP_AND_INFRASTRUCTURE.md](./PHASE_1_SETUP_AND_INFRASTRUCTURE.md) | Setup & Infra | Node.js ES Modules, Docker Compose (Mongo Replica Set + Redis), Razorpay SDK Client, Express App |
| **Phase 2** | [PHASE_2_AUTH_AND_MERCHANTS.md](./PHASE_2_AUTH_AND_MERCHANTS.md) | Merchant & Auth | API Key Generation, SHA-256 Hashing, Auth Middleware, Redis Auth Cache |
| **Phase 3** | [PHASE_3_IDEMPOTENCY_LAYER.md](./PHASE_3_IDEMPOTENCY_LAYER.md) | Safe Retries | `Idempotency-Key` Header, Redis Atomic Locks (`SET NX EX`), Cached Response Replay |
| **Phase 4** | [PHASE_4_PAYMENT_SERVICE_AND_OUTBOX.md](./PHASE_4_PAYMENT_SERVICE_AND_OUTBOX.md) | Payments & Outbox | Payment Intents, Razorpay Order Linking, Mongo ACID Transactions, Transactional Outbox Pattern |
| **Phase 5** | [PHASE_5_BULLMQ_AND_PAYMENT_WORKER.md](./PHASE_5_BULLMQ_AND_PAYMENT_WORKER.md) | BullMQ & Razorpay Worker | BullMQ Queues, Atomic DB Claim, Real Razorpay Order API, Async Status Transitions |
| **Phase 6** | [PHASE_6_IMMUTABLE_LEDGER.md](./PHASE_6_IMMUTABLE_LEDGER.md) | Immutable Ledger | Double-entry / Append-only Ledger, Processing Fees, Mongo Aggregation for Balances |
| **Phase 7** | [PHASE_7_WEBHOOKS_AND_DELIVERY_WORKER.md](./PHASE_7_WEBHOOKS_AND_DELIVERY_WORKER.md) | Webhook Engine | Incoming Razorpay Webhook Verification, Outgoing Merchant Webhooks with HMAC-SHA256, BullMQ Retries |
| **Phase 8** | [PHASE_8_RECONCILIATION_AND_TESTING.md](./PHASE_8_RECONCILIATION_AND_TESTING.md) | Recovery & Testing | Scheduled Reconciliation Sweeper via Razorpay API, Self-healing stuck payments, End-to-End Tests |
| **Phase 9** | [PHASE_9_REFUND_ENGINE.md](./PHASE_9_REFUND_ENGINE.md) | Refund Engine | Partial/Full Refunds, Over-Refund Prevention, BullMQ Razorpay Worker, Immutable Ledger Debits, Webhooks |

---

### Suggested Execution Workflow
1. Start with **Phase 1** to get MongoDB (with replica set) and Redis running, configure your Razorpay test credentials, and test the health check.
2. Complete each phase completely before moving to the next.
3. Every phase contains sample `curl` commands so you can test your work right away.

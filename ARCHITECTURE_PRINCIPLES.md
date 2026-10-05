# SALESTORM SENTINEL: Architecture Principles

## Core Design Principles

### 1. Zero Overselling Above All Invariants (Hard Safety Invariant)
No system failure, network latency, microservice restart, or traffic surge shall ever cause total reserved + sold inventory for a product to exceed its initial allocation.

### 2. High-Speed Shedding at the Edge (Protection of Core DB)
Drop 99%+ of invalid or excess traffic as close to the ingress network edge as possible (Redis Lua pre-check / Gateway rate limits) before it reaches transactional database locks.

### 3. Strict Database-per-Service & Domain Ownership
Each microservice retains exclusive ownership of its data store. No microservice may directly read or write another service's database. Cross-domain interactions occur strictly via synchronous APIs or asynchronous event streams.

### 4. Idempotency at Every Mutation Boundary
Every state-changing API request (Checkout, Reserve, Pay) must accept and enforce a unique client-generated or gateway-issued `Idempotency-Key`. Replays or retries return identical cached responses without executing side effects multiple times.

### 5. Asynchronous Eventual Consistency for Non-Blocking Path
Do not block the core user checkout flow on downstream operations (e.g., invoice generation, order creation, notification dispatch). Publish immutable domain events (`CheckoutInitiated`, `PaymentSucceeded`, `OrderCreated`) to a persistent event bus.

### 6. Defense in Depth & Graceful Degradation
Wrap external third-party dependencies (e.g., Payment Gateway) in Circuit Breakers with fallback options. If downstream services fail, queue messages in Dead Letter Queues (DLQs) or event streams for automatic replay upon service recovery.

### 7. End-to-End Observability & Traceability
Every request carries a unique `X-Correlation-ID` across HTTP headers, gRPC metadata, Redis Stream payload headers, log context, and database query annotations.

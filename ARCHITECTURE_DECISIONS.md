# SALESTORM SENTINEL: Architecture Decision Records (ADRs)

This document details all major architectural decisions for **SALESTORM SENTINEL** formatted with explicit justification: **DECISION**, **ALTERNATIVES**, **WHY SELECTED**, **TRADE-OFF**, and **FAILURE IMPLICATION**.

---

## ADR-01: Single Point of Inventory Truth & Overselling Prevention

- **DECISION:** Use **PostgreSQL Atomic Conditional Row Update (`UPDATE ... WHERE (available - reserved) >= qty`)** as the Single Point of Inventory Truth, paired with **Redis Lua Scripting** as a high-speed edge traffic shedder.
- **ALTERNATIVES:**
  1. Pure Distributed Lock (e.g., Redlock across Redis cluster).
  2. Pure PostgreSQL Transactions with `SELECT FOR UPDATE`.
  3. Distributed Saga / Two-Phase Commit (2PC).
- **WHY SELECTED:**
  - **Zero Overselling Guarantee:** PostgreSQL ACID conditional update guarantees absolute zero overselling at the database row boundary regardless of microservice scaling or race conditions.
  - **Traffic Protection:** Redis Lua script absorbs 9,900 out of 10,000 requests in sub-milliseconds, preventing DB lock contention and connection pool starvation.
- **TRADE-OFF:** Requires dual-state coordination (Redis stock counter + PostgreSQL DB). In rare edge cases of Redis cache drift, PostgreSQL acts as the single source of truth and rejects over-allocated requests.
- **FAILURE IMPLICATION:** If Redis fails, all traffic falls back to PostgreSQL (higher DB load but zero overselling). If PostgreSQL fails, reservations fail safely without corrupting stock data.

---

## ADR-02: Synchronous vs. Asynchronous Workflows

- **DECISION:** Use **Synchronous gRPC/HTTP** for inventory reservation check (Client $\rightarrow$ API Gateway $\rightarrow$ Checkout $\rightarrow$ Inventory), and **Asynchronous Event-Driven Pub/Sub via Redis Streams** for Payment, Order Creation, and Notifications.
- **ALTERNATIVES:**
  1. Fully Synchronous REST API across all services (Checkout $\rightarrow$ Inventory $\rightarrow$ Payment $\rightarrow$ Order).
  2. Fully Asynchronous Event Sourcing (Client receives 202 Accepted for everything).
- **WHY SELECTED:**
  - Users need immediate confirmation whether their flash-sale inventory reservation succeeded (`200 OK` vs `410 Gone / Out of Stock`).
  - Order creation and notification dispatch do not need to block the user's payment flow; decoupling them protects the core checkout path from downstream latency spikes.
- **TRADE-OFF:** Eventual consistency between Payment Succeeded state and Order Creation state.
- **FAILURE IMPLICATION:** If Order Service crashes, Payment is already completed; Redis Streams persists the event until Order Service recovers and replays.

---

## ADR-03: Payment & Request Idempotency Guarantee

- **DECISION:** Enforce **Idempotency Key Verification** at the API Gateway layer and Payment Service using Redis-backed distributed locks and payload hashes.
- **ALTERNATIVES:**
  1. Client-side retry throttling only.
  2. In-memory deduplication table per service instance.
- **WHY SELECTED:**
  - Guarantees that duplicate network submissions (due to user double-clicking or mobile network retries) do not result in double charges or multiple stock reservations.
- **TRADE-OFF:** Adds a Redis lookup step on incoming write requests.
- **FAILURE IMPLICATION:** If idempotency key lookup times out, request fails safely with a retryable 503 error, preventing duplicate execution.

---

## ADR-04: Handling Reservation Expiry & Payment Timeouts

- **DECISION:** Dual-layer reservation expiry: **Redis Key TTL Expiry Events** combined with a **PostgreSQL Sweeper Background Worker**.
- **ALTERNATIVES:**
  1. Synchronous polling on every user request.
  2. Delayed Kafka messages.
- **WHY SELECTED:**
  - Ensures stock reserved by abandoned or timed-out payment sessions (e.g., user closes browser during payment) is released back into `available_quantity` within 10 minutes.
- **TRADE-OFF:** Background sweeper query load on DB.
- **FAILURE IMPLICATION:** If background sweeper is delayed, expired stock release is slightly delayed, but stock is never lost or prematurely double-booked.

---

## ADR-05: Order Service Outage Resilience (Event Replay)

- **DECISION:** Use **Redis Streams with Consumer Groups** for event persistence and offset tracking.
- **ALTERNATIVES:**
  1. Direct HTTP webhooks between Payment Service and Order Service.
  2. RabbitMQ without persistent event log.
- **WHY SELECTED:**
  - Redis Streams acts as a lightweight persistent commit log. If Order Service crashes for 1 hour, `PaymentSucceeded` events accumulate in the stream. Upon recovery, Order Service resumes reading from its last acknowledged ACK offset.
- **TRADE-OFF:** Storage footprint in Redis for event history (mitigated by stream trimming / XTRIM).
- **FAILURE IMPLICATION:** Order creation is delayed during service outage, but zero orders are lost.

---

## ADR-06: Observability & Security Strategy

- **DECISION:** Implement **OpenTelemetry distributed tracing** with `X-Correlation-ID` propagation across HTTP, gRPC, and Redis Stream headers, combined with **Prometheus metrics** (RPS, stock count, circuit breaker status).
- **ALTERNATIVES:**
  1. Simple localized application logs without correlation IDs.
- **WHY SELECTED:**
  - Enables instant identification of bottlenecks during 10,000 RPS flash sale bursts and tracks exact order fulfillment journeys across microservices.
- **TRADE-OFF:** Slight CPU overhead for trace instrumentation.
- **FAILURE IMPLICATION:** Trace collection dropping during extreme bursts does not affect core business transaction processing.

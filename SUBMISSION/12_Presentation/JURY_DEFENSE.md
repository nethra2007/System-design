# SALESTORM SENTINEL: Hostile Jury Technical Defense Guide

This document presents **30 Hostile Technical Jury Questions**, strong answers, weak answers to avoid, architectural evidence, relevant diagrams, and the **Top 10 Most Likely Jury Questions**.

---

## 1. Top 10 Most Likely Jury Questions

1. **Q1: Where EXACTLY is overselling prevented?**
2. **Q2: How do you handle 10,000 concurrent requests hitting a single database row without locking up PostgreSQL?**
3. **Q3: What happens if Redis crashes right during the peak flash sale moment?**
4. **Q4: How do you prevent duplicate charges if a user double-clicks the Buy button or retries on a slow mobile connection?**
5. **Q5: What happens if a payment succeeds but the Order Service crashes for 30 seconds? Is the order lost?**
6. **Q6: If a payment times out or card gets declined, how is reserved inventory returned to the available pool?**
7. **Q7: What prevents an attacker from spamming the reservation endpoint with fake idempotency keys to drain stock?**
8. **Q8: How does your system handle payment gateway outages or slow response times (>2 seconds)?**
9. **Q9: Can a user hold inventory indefinitely by abandoning the checkout screen after reserving?**
10. **Q10: What is the single biggest architectural trade-off or sacrifice in SALESTORM SENTINEL?**

---

## 2. Complete 30 Hostile Technical Questions & Defense Strategies

### Category 1: Concurrency, Inventory Consistency & Race Conditions

#### Q1: Where EXACTLY is overselling prevented?
- **EXPECTED STRONG ANSWER:** Overselling is strictly prevented at the **PostgreSQL Database Layer inside Inventory Service** using an atomic conditional update statement: `UPDATE inventory SET reserved_quantity = reserved_quantity + :qty WHERE product_id = :id AND (available_quantity - reserved_quantity) >= :qty`. If affected rows = 0, the reservation fails deterministically.
- **WEAK ANSWER TO AVOID:** "We prevent overselling in Redis using a counter or in frontend JavaScript."
- **ARCHITECTURAL EVIDENCE:** [`src/inventory.repository.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/inventory.repository.ts#L45-L65), [`ARCHITECTURE.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/ARCHITECTURE.md#L10-L25).
- **RELEVANT DIAGRAM:** Component Diagram (C4 Level 3) in [`ARCHITECTURE_DIAGRAMS.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/ARCHITECTURE_DIAGRAMS.md#L165-L210).

#### Q2: How do you prevent 10,000 concurrent requests from locking up PostgreSQL on a single hot product row?
- **EXPECTED STRONG ANSWER:** We use **Redis Lua pre-filtering at the edge**. Redis atomic `DECRBY` absorbs 9,900 out of 10,000 requests in sub-milliseconds before they reach PostgreSQL, allowing only ~100-150 valid requests to touch the database lock.
- **WEAK ANSWER TO AVOID:** "PostgreSQL can handle 10,000 connections effortlessly."
- **ARCHITECTURAL EVIDENCE:** [`INVENTORY_MECHANISM_COMPARISON.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/INVENTORY_MECHANISM_COMPARISON.md#L15-L35).
- **RELEVANT DIAGRAM:** Container Diagram (C4 Level 2) in [`ARCHITECTURE_DIAGRAMS.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/ARCHITECTURE_DIAGRAMS.md#L100-L160).

#### Q3: What happens if Redis stock counter drifts from PostgreSQL DB stock?
- **EXPECTED STRONG ANSWER:** Redis is a high-speed traffic shedding filter, but **PostgreSQL is the single source of truth**. If Redis drifts high, PostgreSQL ACID assertions reject over-allocated requests safely (zero overselling). If Redis drifts low, a background sync worker reconciles Redis counters with DB state.
- **WEAK ANSWER TO AVOID:** "Redis and PostgreSQL are always perfectly synchronized via two-phase commit."
- **ARCHITECTURAL EVIDENCE:** [`ARCHITECTURE_DECISION_RECORDS.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/ARCHITECTURE_DECISION_RECORDS.md#L20-L40).
- **RELEVANT DIAGRAM:** Component Diagram in [`ARCHITECTURE_DIAGRAMS.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/ARCHITECTURE_DIAGRAMS.md).

#### Q4: Why not use Optimistic Concurrency Control (CAS / Version numbers) instead of Row-Level Locking?
- **EXPECTED STRONG ANSWER:** Under high single-row contention (10,000 requests competing for 100 units), Optimistic CAS causes 9,900 requests to constantly fail and retry, causing CPU burn and thread starvation. Atomic conditional update resolves allocation in a single SQL roundtrip.
- **WEAK ANSWER TO AVOID:** "Optimistic locking is always faster than pessimistic locking."
- **ARCHITECTURAL EVIDENCE:** [`ARCHITECTURE_DECISION_RECORDS.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/ARCHITECTURE_DECISION_RECORDS.md#L45-L65).
- **RELEVANT DIAGRAM:** State Machine Diagram in [`LLD.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/LLD.md).

#### Q5: Can available inventory ever become negative under race conditions?
- **EXPECTED STRONG ANSWER:** No. PostgreSQL table schema enforces a hard database constraint `CHECK (available_quantity >= reserved_quantity + sold_quantity)` and `CHECK (available_quantity >= 0)`.
- **WEAK ANSWER TO AVOID:** "Our application logic checks if quantity > 0 before updating."
- **ARCHITECTURAL EVIDENCE:** [`DATABASE_SCHEMA.sql`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/DATABASE_SCHEMA.sql#L35-L45).
- **RELEVANT DIAGRAM:** Component Diagram in [`ARCHITECTURE_DIAGRAMS.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/ARCHITECTURE_DIAGRAMS.md).

---

### Category 2: Idempotency, Duplicates & Gateway Security

#### Q6: How do you prevent duplicate reservations when a user double-clicks Buy?
- **EXPECTED STRONG ANSWER:** Enforced via `X-Idempotency-Key` headers saved in Redis with a 24-hour TTL and unique DB index `inventory_reservation(idempotency_key)`. Replay calls return the original reservation payload instantly without re-debiting stock.
- **WEAK ANSWER TO AVOID:** "We disable the Buy button on the frontend after clicking."
- **ARCHITECTURAL EVIDENCE:** [`src/reservation.service.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/reservation.service.ts#L18-L35).
- **RELEVANT DIAGRAM:** Sequence Diagram in [`LLD.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/LLD.md).

#### Q7: How do you prevent duplicate charges at the payment gateway level?
- **EXPECTED STRONG ANSWER:** `PaymentService` checks `payment(idempotency_key)` before contacting external payment APIs. If a payment attempt with the same key was already processed, the existing transaction record is returned without re-executing gateway charges.
- **WEAK ANSWER TO AVOID:** "Payment gateways handle deduplication automatically."
- **ARCHITECTURAL EVIDENCE:** [`src/payment.service.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/payment.service.ts#L22-L40).
- **RELEVANT DIAGRAM:** Sequence Diagram in [`LLD.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/LLD.md).

#### Q8: What prevents an attacker from generating random idempotency keys to drain 100 stock units?
- **EXPECTED STRONG ANSWER:** Ingress Rate Limiting at API Gateway (5 req/sec per IP / Customer ID) combined with JWT authentication (`ROLE_CUSTOMER`). An attacker cannot claim all stock without authenticated customer credentials.
- **WEAK ANSWER TO AVOID:** "Idempotency keys are unique so attacks don't matter."
- **ARCHITECTURAL EVIDENCE:** [`SECURITY.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/SECURITY.md#L15-L30).
- **RELEVANT DIAGRAM:** Container Diagram in [`ARCHITECTURE_DIAGRAMS.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/ARCHITECTURE_DIAGRAMS.md).

---

### Category 3: Outages, Saga Recovery & Event Bus

#### Q9: What happens if Payment succeeds but Order Service is DOWN for 30 seconds? Is the order lost?
- **EXPECTED STRONG ANSWER:** No. Payment Service publishes `PaymentSucceededEvent` to a persistent **Redis Stream**. Order Service uses Consumer Groups with explicit ACKs. During an outage, events remain in the Pending Entry List (PEL). Once Order Service recovers, a background worker consumes unacknowledged pending events and retroactively creates missing orders.
- **WEAK ANSWER TO AVOID:** "We retry the REST endpoint until Order Service comes back up."
- **ARCHITECTURAL EVIDENCE:** [`src/order.service.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/order.service.ts#L55-L80), [`SAGA_RECOVERY_FLOW.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/SAGA_RECOVERY_FLOW.md#L15-L40).
- **RELEVANT DIAGRAM:** High-Level Architecture Diagram in [`ARCHITECTURE_DIAGRAMS.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/ARCHITECTURE_DIAGRAMS.md#L45-L95).

#### Q10: How do you prevent event duplication when replaying messages from Redis Streams?
- **EXPECTED STRONG ANSWER:** `OrderService` checks `order(transaction_reference)` before inserting an order record. If an event is replayed, the existing order is returned idempotently without creating duplicate orders.
- **WEAK ANSWER TO AVOID:** "Redis Streams guarantees exactly-once delivery."
- **ARCHITECTURAL EVIDENCE:** [`src/order.service.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/order.service.ts#L30-L45).
- **RELEVANT DIAGRAM:** Sequence Diagram in [`LLD.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/LLD.md).

---

### Category 4: Fault Tolerance, Circuit Breakers & Expiry

#### Q11: What happens when the External Payment Gateway times out or experiences high latency (>2 seconds)?
- **EXPECTED STRONG ANSWER:** `SimulatedPaymentGatewayAdapter` wraps payment API calls in a **Circuit Breaker Pattern**. If error rates exceed 50% or timeout thresholds, the circuit trips to `OPEN`, immediately fast-failing traffic in sub-milliseconds without blocking gateway workers.
- **WEAK ANSWER TO AVOID:** "We wait for the gateway API to respond regardless of how long it takes."
- **ARCHITECTURAL EVIDENCE:** [`src/payment-gateway.adapter.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/payment-gateway.adapter.ts#L20-L45).
- **RELEVANT DIAGRAM:** Component Diagram in [`ARCHITECTURE_DIAGRAMS.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/ARCHITECTURE_DIAGRAMS.md).

#### Q12: If a payment fails or card gets declined, how is reserved stock restored?
- **EXPECTED STRONG ANSWER:** Payment Service emits a `PaymentFailedEvent`. The Inventory Service subscriber executes an atomic stock release: `reserved_quantity = Math.max(0, reserved_quantity - qty)`, returning units back to the available pool.
- **WEAK ANSWER TO AVOID:** "The user has to manually cancel their reservation."
- **ARCHITECTURAL EVIDENCE:** [`src/reservation.service.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/reservation.service.ts#L70-L85).
- **RELEVANT DIAGRAM:** State Diagram in [`LLD.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/LLD.md).

#### Q13: Can a user hold stock indefinitely by closing their browser after reserving?
- **EXPECTED STRONG ANSWER:** No. Reservations are granted with a strict **10-minute TTL (`expires_at`)**. A background sweeper worker scans for expired reservations and executes atomic stock release.
- **WEAK ANSWER TO AVOID:** "Reserved stock stays reserved until the user pays."
- **ARCHITECTURAL EVIDENCE:** [`src/reservation.service.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/reservation.service.ts#L88-L105).
- **RELEVANT DIAGRAM:** State Diagram in [`LLD.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/LLD.md).

---

### Category 5: Scalability & Observability

#### Q14: How does this system scale if traffic increases by 50x (500,000 RPS)?
- **EXPECTED STRONG ANSWER:** Horizontal Pod Autoscaling (HPA) scales Envoy API Gateway (5 to 50 pods) and Checkout microservices (10 to 100 pods). Redis Cluster sharding handles traffic shedding. PostgreSQL write throughput scales via inventory partitioning or virtual inventory buckets.
- **WEAK ANSWER TO AVOID:** "We just upgrade our server to a larger AWS instance."
- **ARCHITECTURAL EVIDENCE:** [`Deployment Diagram`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/ARCHITECTURE_DIAGRAMS.md#L215-L270).
- **RELEVANT DIAGRAM:** Deployment Diagram in [`ARCHITECTURE_DIAGRAMS.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/ARCHITECTURE_DIAGRAMS.md).

#### Q15: How do you trace a single purchase request across API Gateway, Inventory, Payment, and Order microservices?
- **EXPECTED STRONG ANSWER:** Via **`X-Correlation-ID` propagation**. The API Gateway injects a correlation ID into HTTP headers, which is forwarded through gRPC calls, Redis Stream event headers, and structured JSON log contexts across all services.
- **WEAK ANSWER TO AVOID:** "We search application logs for the user's IP address."
- **ARCHITECTURAL EVIDENCE:** [`OBSERVABILITY.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/OBSERVABILITY.md#L10-L30), [`src/server.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/server.ts#L18-L25).
- **RELEVANT DIAGRAM:** High-Level Architecture Diagram in [`ARCHITECTURE_DIAGRAMS.md`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/ARCHITECTURE_DIAGRAMS.md).

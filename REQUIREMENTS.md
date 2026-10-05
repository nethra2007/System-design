# SALESTORM SENTINEL: System Requirements

## 1. Functional Requirements (FR)

- **FR-1: Flash-Sale Inventory Reservation:** System must allow users to reserve inventory for a flash-sale item during high-concurrency bursts.
- **FR-2: Zero Overselling:** System must strictly limit total stock reservations to the exact available stock count (e.g., exactly 100 units for 10,000 concurrent requests).
- **FR-3: Temporary Inventory Expiry:** Reservations must hold stock for a fixed TTL (e.g., 10 minutes). Unpaid reservations must automatically expire and return stock back to the pool.
- **FR-4: Idempotent Checkout & Payment:** Repeated checkout/payment requests with the same `Idempotency-Key` must execute at most once.
- **FR-5: Payment Processing Integration:** Integrate with an external Payment Gateway (simulated) supporting success, payment failure, and network timeout states.
- **FR-6: Reliable Order Creation:** Orders must be created asynchronously upon payment success. In case of Order Service downtime, orders must be processed retroactively when recovered.
- **FR-7: Order Lifecycle Tracking:** Support explicit state transitions: `INITIATED` $\rightarrow$ `RESERVED` $\rightarrow$ `PAID` $\rightarrow$ `ORDER_CREATED` $\rightarrow$ `CANCELLED` / `EXPIRED`.
- **FR-8: Notifications:** Asynchronously send confirmation upon successful order creation or cancellation.

---

## 2. Non-Functional Requirements (NFR)

- **NFR-1: Concurrency & Scalability:** Handle 10,000 concurrent requests arriving within a 1-second burst window without crashing or dropping database connections.
- **NFR-2: Strict Data Consistency (ACID for Inventory):** Zero overselling guaranteed even under distributed race conditions.
- **NFR-3: Low Latency:** 95th percentile latency for checkout response $\le 200\text{ ms}$. Fast shedding for out-of-stock requests in $< 20\text{ ms}$.
- **NFR-4: High Availability & Fault Tolerance:** Core services resilient to single-instance failures; event streams handle downstream outages.
- **NFR-5: Security & Auditability:** Rate limiting against bot traffic; idempotency key validation; immutable audit logs for stock changes.
- **NFR-6: Observability:** Distributed tracing, metrics (RPS, latency percentiles, stock count, circuit breaker state), and structured logs.

---

## 3. System Constraints & Assumptions

- **Flash Sale Scale:** 10,000 concurrent checkout requests for 100 stock units.
- **Payment Latency:** External Payment Gateway simulator latency between 200ms and 1500ms with a 10% failure rate and 5% timeout rate.
- **Reservation Hold Time:** 10 minutes TTL before automatic cancellation.
- **Technology Boundaries:** Use lightweight containerizable microservices (e.g., Go/Node.js), Redis (Cache/Streams), and PostgreSQL.

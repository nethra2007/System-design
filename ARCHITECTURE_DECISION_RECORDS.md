# SALESTORM SENTINEL: Comprehensive Architecture Decision Records (ADRs)

This document presents a Principal Architect's evaluation of the 8 core architectural decisions governing **SALESTORM SENTINEL**.

---

## ADR-01: Relational Database (PostgreSQL) vs. NoSQL (MongoDB / DynamoDB)

- **1. PROBLEM:** Needs absolute transaction isolation to prevent inventory overselling during 10,000 RPS flash sale bursts.
- **2. OPTIONS CONSIDERED:** 
  - Option A: PostgreSQL (ACID Relational Database).
  - Option B: MongoDB / DynamoDB (NoSQL / Document Store).
- **3. SELECTED APPROACH:** PostgreSQL (ACID Relational Database).
- **4. WHY:** PostgreSQL provides strict ACID transactions and atomic row-level locking (`UPDATE ... WHERE (available - reserved) >= qty`). NoSQL databases offering eventual consistency or document-level locks risk race conditions and lost updates under extreme concurrency.
- **5. ADVANTAGES:** Immutable zero-overselling guarantee; strict constraints (`CHECK (available_quantity >= 0)`).
- **6. DISADVANTAGES:** Harder horizontal write scaling compared to partitionable NoSQL databases.
- **7. FAILURE IMPLICATIONS:** If PostgreSQL primary fails, write transactions pause until Multi-AZ failover completes.
- **8. SCALABILITY IMPLICATIONS:** Read scaling offloaded to read replicas; write contention mitigated by Redis pre-filtering.

---

## ADR-02: Redis Edge Pre-Filtering vs. Database-Only Inventory Control

- **1. PROBLEM:** Directing 10,000 concurrent database connections to a single PostgreSQL row causes connection pool starvation and high latency.
- **2. OPTIONS CONSIDERED:** 
  - Option A: Database-only inventory control.
  - Option B: Two-tier hybrid (Redis Lua script pre-check + PostgreSQL row lock).
- **3. SELECTED APPROACH:** Two-tier hybrid (Redis Lua pre-check + PostgreSQL row lock).
- **4. WHY:** Redis atomic Lua scripts execute in sub-milliseconds, dropping 9,900 out of 10,000 requests at the network edge so PostgreSQL only receives ~100-150 valid requests.
- **5. ADVANTAGES:** Ultra-low latency for out-of-stock rejections (<20ms); protects DB from traffic overload.
- **6. DISADVANTAGES:** Requires maintaining dual state (Redis stock counter + PostgreSQL DB).
- **7. FAILURE IMPLICATIONS:** If Redis fails, traffic falls back to PostgreSQL (higher DB load, but zero overselling).
- **8. SCALABILITY IMPLICATIONS:** Redis scales horizontally via Redis Cluster sharding.

---

## ADR-03: Pessimistic Row-Level Locking vs. Optimistic Concurrency (CAS / Versioning)

- **1. PROBLEM:** High contention on a single row (100 units for 10,000 requests) causes high retry rates under Optimistic Concurrency Control (OCC).
- **2. OPTIONS CONSIDERED:** 
  - Option A: Optimistic Concurrency Control with version numbers (`WHERE version = 1`).
  - Option B: Atomic Conditional Update (`UPDATE ... WHERE (total - reserved - sold) >= qty`).
- **3. SELECTED APPROACH:** Atomic Conditional Update.
- **4. WHY:** OCC forces 9,900 requests to continuously fail and retry, consuming CPU cycles. Atomic conditional update resolves stock allocation in a single atomic SQL statement without application retries.
- **5. ADVANTAGES:** Single SQL roundtrip; zero application-level retry overhead.
- **6. DISADVANTAGES:** DB row-level lock duration must be kept under 5ms.
- **7. FAILURE IMPLICATIONS:** Slow DB queries delay row lock release.
- **8. SCALABILITY IMPLICATIONS:** Max throughput bounded by PostgreSQL single-row update latencies (~2,000 - 4,000 TPS).

---

## ADR-04: Synchronous vs. Asynchronous Communication

- **1. PROBLEM:** Balancing immediate user feedback for reservation results against system throughput for order fulfillment.
- **2. OPTIONS CONSIDERED:** 
  - Option A: Fully Synchronous REST API across all services.
  - Option B: Hybrid (Synchronous Reservation Check + Asynchronous Event-Driven Order Processing).
- **3. SELECTED APPROACH:** Hybrid.
- **4. WHY:** Inventory reservation requires immediate synchronous confirmation (`200 OK` vs `409 Out of Stock`). Order creation and notification dispatch do not need to block the payment flow.
- **5. ADVANTAGES:** Decouples core checkout path from downstream service latencies.
- **6. DISADVANTAGES:** Introduces eventual consistency between payment completion and order generation.
- **7. FAILURE IMPLICATIONS:** Downstream service outages do not crash the checkout API.
- **8. SCALABILITY IMPLICATIONS:** Downstream workers scale independently via consumer groups.

---

## ADR-05: Redis Streams Event Bus vs. Direct HTTP Service Calls

- **1. PROBLEM:** Direct HTTP webhooks between Payment Service and Order Service risk lost orders if Order Service crashes during a surge.
- **2. OPTIONS CONSIDERED:** 
  - Option A: Direct HTTP REST webhooks.
  - Option B: Persistent Event Log via Redis Streams / Kafka.
- **3. SELECTED APPROACH:** Redis Streams Event Bus.
- **4. WHY:** Redis Streams acts as a durable commit log with consumer groups and Pending Entry Lists (PEL). Unacknowledged events remain stored during outages and replay automatically upon service recovery.
- **5. ADVANTAGES:** Guaranteed event delivery; zero order loss during outages.
- **6. DISADVANTAGES:** Requires managing stream retention and memory limits (`XTRIM`).
- **7. FAILURE IMPLICATIONS:** If Order Service crashes for 1 hour, events accumulate safely in stream memory.
- **8. SCALABILITY IMPLICATIONS:** Consumer groups partition message processing across multiple worker instances.

---

## ADR-06: Cache-Aside Reads vs. Database-Only Reads

- **1. PROBLEM:** High read traffic on static product catalog data during flash sales degrades database performance.
- **2. OPTIONS CONSIDERED:** 
  - Option A: Database-only reads.
  - Option B: Cache-Aside pattern via Redis.
- **3. SELECTED APPROACH:** Cache-Aside pattern via Redis.
- **4. WHY:** Static product details (title, description, price) are cached in Redis with TTLs, offloading 99% of read traffic from PostgreSQL.
- **5. ADVANTAGES:** Sub-millisecond catalog read latencies; drops DB read IOPS to near zero.
- **6. DISADVANTAGES:** Potential cache staleness during product metadata updates.
- **7. FAILURE IMPLICATIONS:** Cache miss falls back safely to PostgreSQL.
- **8. SCALABILITY IMPLICATIONS:** Redis read replicas scale catalog throughput linearly.

---

## ADR-07: Distributed Saga Pattern vs. Two-Phase Commit (2PC)

- **1. PROBLEM:** Managing transactional integrity across Inventory, Payment, and Order microservices without blocking distributed locks.
- **2. OPTIONS CONSIDERED:** 
  - Option A: Two-Phase Commit (2PC) / XA Transactions.
  - Option B: Event-Driven Choreography Saga with Compensation Actions.
- **3. SELECTED APPROACH:** Event-Driven Choreography Saga.
- **4. WHY:** 2PC introduces blocking locks across network boundaries, creating single points of failure and high latency. The Saga pattern uses asynchronous compensating transactions (e.g. `PaymentFailedEvent` $\rightarrow$ Release Stock) to guarantee eventual consistency without blocking network locks.
- **5. ADVANTAGES:** High availability and fault isolation across microservices.
- **6. DISADVANTAGES:** Temporary state inconsistency during saga execution.
- **7. FAILURE IMPLICATIONS:** If a step fails, compensating events revert prior changes.
- **8. SCALABILITY IMPLICATIONS:** Non-blocking design allows microservices to scale independently.

---

## 8. Explicit Architectural Trade-Offs & Sacrifices

| Dimension | What SALESTORM SENTINEL Sacrifices | What SALESTORM SENTINEL Gains |
| :--- | :--- | :--- |
| **Consistency vs Availability** | Sacrifices immediate cross-service consistency. | Gains ultra-high availability for core checkout. |
| **Simplicity vs Resilience** | Sacrifices single-monolith simplicity for event-driven microservices. | Gains fault isolation and outage recovery. |
| **Immediate vs Eventual Consistency** | Sacrifices real-time order creation. | Gains asynchronous payment processing and queue shaving. |

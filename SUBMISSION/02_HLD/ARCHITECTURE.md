# SALESTORM SENTINEL Architecture Specification

## 1. Executive Summary & Inventory Correctness Model

**SALESTORM SENTINEL** is a high-concurrency flash-sale architecture engineered to handle extreme traffic spikes (e.g., 10,000+ concurrent checkout requests for a limited pool of 100 available inventory units) without overselling, lost updates, or double charges.

### Where Exactly is Overselling Prevented?
> **SINGLE POINT OF INVENTORY TRUTH:**
> Inventory correctness is guaranteed exclusively within the **Inventory & Reservation Service database layer** using **Atomic Database Row-Level Locking with Conditional UPDATE Assertions in PostgreSQL**:
> 
> ```sql
> UPDATE inventory 
> SET reserved_quantity = reserved_quantity + :qty,
>     updated_at = NOW()
> WHERE product_id = :product_id 
>   AND (available_quantity - reserved_quantity) >= :qty;
> ```
> 
> - **Zero-Overcommit Guarantee:** If affected rows = 0, the reservation immediately fails. No overselling can physically occur regardless of network latency, API retries, or concurrent traffic.
> - **Redis as High-Speed Traffic Shield:** Redis atomicity (`DECRBY` / Lua scripts) acts as a high-speed shedding filter to reject 99% of excess traffic (e.g., requests beyond 100 units) in sub-milliseconds before hitting PostgreSQL.
> - **Dual-Layer Defense:** Redis guards PostgreSQL from traffic overload; PostgreSQL enforces the immutable ACID invariant.

---

## 2. Dynamic Flow & Architectural Boundaries

### Boundaries Definition:
- **Synchronous Boundary:** REST / gRPC synchronous requests (Client $\rightarrow$ API Gateway $\rightarrow$ Cart / Inventory / Checkout Services).
- **Asynchronous Event Boundary:** Message Broker (Redis Streams / Kafka / NATS) decoupled event processing (Checkout Service $\rightarrow$ Payment Service $\rightarrow$ Order Service $\rightarrow$ Notification Service).
- **Database Ownership:** Microservices maintain **Database per Service**. No cross-service direct DB access.
- **Cache Usage:** Redis serves as an fast-read cache (Product metadata), high-throughput traffic filter (Flash-sale stock pre-reservation), and distributed lock manager (Redlock / Idempotency tokens).
- **Idempotency Boundary:** Enforced at API Gateway (Idempotency-Key caching) and inside Checkout & Payment Services (Unique payload/transaction hash verification).
- **Failure Boundaries:** Circuit Breakers (Resilience4j / Envoy) wrap synchronous dependencies; Dead Letter Queues (DLQ) isolate unprocessable asynchronous messages.

---

## 3. Bottleneck Analysis & Horizontal Scaling Strategy

| Component / Layer | Potential Bottleneck | Mitigation & Horizontal Scaling Strategy |
| :--- | :--- | :--- |
| **Ingress Layer (WAF / Load Balancer / API Gateway)** | TCP connection exhaustion, rate-limit evaluation overhead | Distributed Envoy / Kong Gateway instances scaled horizontally across Availability Zones with IP rate-limiting at Cloudflare CDN edge. |
| **Redis Cache / Streams** | Single-key contention on popular flash sale product ID | Redis Cluster with Hash Tags or Lua script batching; read replicas for static product catalog data; Redis Streams partitioned by shard keys. |
| **Inventory & Reservation Service** | DB Row Lock contention on 100 available units under 10k RPS | 1. Redis Lua pre-filtering drops 9,900 requests.<br>2. Short-lived DB transactions with strict timeouts.<br>3. Row contention minimized by batching reservations or splitting stock across virtual inventory buckets if required. |
| **Payment Service & External Gateway** | External Gateway latency (500ms - 2s), third-party rate limits | Asynchronous worker pool handling payment execution using worker pools (Go goroutines / worker threads) with connection pooling and circuit breakers. |
| **Order Service & PostgreSQL** | High write IOPS for order creation during peak sale | Event-driven decoupled order creation via Redis Streams; worker pools consume events at controlled rates (Traffic Shaving / Backpressure). |

---

## 4. Resilience & Failure Scenario Handling

| Failure Scenario | Architectural Resilience Mechanism |
| :--- | :--- |
| **10,000 Concurrent Requests for 100 Units** | **Redis Sharding & Pre-check:** Redis drops 9,900+ requests instantly. Only top ~100-150 requests reach PostgreSQL for atomic reservation. |
| **Duplicate Request Handling** | **Idempotency Keys:** Enforced at Gateway and Checkout. Deduplication key `idempotency:checkout:{key}` stored in Redis with TTL. Duplicate calls return cached response. |
| **Payment Failure** | **Automatic Reservation Release:** Payment failure emits `PaymentFailed` event $\rightarrow$ Inventory Service listens and executes DB atomic release (`reserved_quantity = reserved_quantity - qty`). |
| **Payment Timeout** | **Reconciliation & Expiry Worker:** Reservation created with TTL (e.g., 10 mins). A background Cron / Task scheduler queries stale reservations without completed payments and releases inventory automatically. |
| **Order Service Outage** | **Event Sourcing & Replay:** Redis Streams / Kafka persists `PaymentSucceeded` events. When Order Service recovers, it resumes reading from offset without data loss. |
| **Reservation Expiry** | **TTL Sweeper:** Redis key expiry / DB background worker scans `EXPIRED` status reservations and returns units back to `available_quantity`. |
| **Database Failure** | **Multi-AZ HA & Read Replicas:** Managed PostgreSQL with automatic failover (Primary-Standby). Read queries offloaded to read replicas. |
| **Payment Gateway Failure** | **Circuit Breakers & Fallback:** Gateway wraps calls in a circuit breaker. If error rate exceeds threshold, immediate fallback to user notification ("Payment Gateway Busy, Try Again"). |
| **Order Confirmation Notifications** | **Asynchronous Fan-out:** Order Service emits `OrderCreated` $\rightarrow$ Notification Service picks up event and asynchronously dispatches email/SMS without blocking checkout execution path. |

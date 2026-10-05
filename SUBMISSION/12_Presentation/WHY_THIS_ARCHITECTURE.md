# WHY SALESTORM SENTINEL ARCHITECTURE?
### Executive Briefing for Jury & Technical Defense

---

### The Fundamental Problem
During a flash sale (10,000 concurrent requests competing for 100 available stock units), standard e-commerce systems fail in one of two catastrophic ways:
1. **Overselling (Lost Invariant):** Race conditions cause total reservations to exceed available stock, leading to cancelled orders, financial refunds, and brand damage.
2. **Database Collapse (Cascading Failure):** Directing 10,000 concurrent transactions to relational database locks causes connection starvation, high latency ($>10\text{s}$), and system crashes.

---

### The Core Architectural Solution
**SALESTORM SENTINEL** solves both challenges using a **Two-Tier Defense-in-Depth Architecture**:

```
[10,000 Concurrent Users] ──► [Redis Edge Traffic Shedder] ──► [PostgreSQL ACID Row Lock Engine]
                                    │                                  │
                          (Drops 9,900 Requests)             (Grants Exactly 100 Units)
```

1. **Tier 1: Redis Edge Traffic Shedder (Protection Layer)**
   - Atomic Redis Lua scripts execute in sub-milliseconds, shedding 9,900 out of 10,000 excess requests at the ingress network boundary before they reach transactional database locks.

2. **Tier 2: PostgreSQL Atomic Conditional Update (Immutable Invariant Layer)**
   - **WHERE EXACTLY IS OVERSELLING PREVENTED?**
   - Overselling is strictly prevented inside PostgreSQL using atomic conditional row updates:
     ```sql
     UPDATE inventory SET reserved_quantity = reserved_quantity + :qty
     WHERE product_id = :product_id AND (available_quantity - reserved_quantity) >= :qty;
     ```
   - If `affected_rows == 0`, the transaction fails deterministically. Overselling is physically impossible.

---

### Key System Invariants Verified
- **Zero Overselling:** `reserved_quantity + sold_quantity <= 100` (Verified by 10,000 RPS test harness).
- **Idempotency Guarantee:** Replay attacks with identical `X-Idempotency-Key` headers return cached responses without duplicate stock debits or double charges.
- **Outage Resilience (Saga Pattern):** If Order Service suffers a 30-second downtime, `PaymentSucceeded` events persist in Redis Streams consumer groups (PEL) and automatically replay upon service recovery.

---

### What This Architecture Sacrifices
- **Immediate Order Consistency:** Sacrifices real-time synchronous order generation in favor of asynchronous event-driven processing.
- **Operational Simplicity:** Requires managing distributed microservice boundaries and Redis Stream commit logs rather than a single monolithic database.

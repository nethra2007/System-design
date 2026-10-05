# Inventory Reservation Mechanism Comparison & Selection

## 1. Comparison of Approaches

| Criteria | Approach 1: PostgreSQL Atomic Conditional Update (`UPDATE ... WHERE (available - reserved) >= qty`) | Approach 2: Redis Atomic Pre-Reservation (`DECRBY` / Lua Scripting) |
| :--- | :--- | :--- |
| **Consistency / Safety** | **Absolute ACID Invariant.** Row-level lock guarantees zero overselling directly inside DB. Cannot drift or corrupt. | **Eventual Consistency.** Highly performant single-threaded counter, but requires sync logic to handle Redis node crashes or memory eviction. |
| **Throughput & Concurrency** | ~1,000 - 3,000 TPS under lock contention on a single row. High connection pool pressure if unmitigated. | ~50,000+ TPS. Extremely fast in-memory execution drops 9,900 out of 10,000 requests in sub-milliseconds. |
| **Persistence & Durability** | **Immediate WAL disk persistence.** Durable state across restarts. | In-memory with optional AOF/RDB persistence. Small window of loss on sudden power failure unless configured synchronously. |
| **Implementation Complexity** | Simple single SQL statement per attempt. Standard relational constraints. | Requires Lua script atomicity + sync worker to reconcile Redis counter with relational database storage. |

---

## 2. Selection & Architectural Rationale

### Selected Mechanism: **Hybrid Two-Tier Engine with PostgreSQL Atomic Conditional Update as Primary Invariant**

For absolute correctness under 10,000 concurrent purchase attempts for 100 units, **PostgreSQL Atomic Conditional Row Update** is selected as the **Primary Invariant Enforcement Mechanism**:

```sql
UPDATE inventory 
SET reserved_quantity = reserved_quantity + $1, 
    updated_at = NOW() 
WHERE product_id = $2 
  AND (total_quantity - reserved_quantity - sold_quantity) >= $1
RETURNING *;
```

### Why Selected:
1. **Deterministic Zero-Overselling Guarantee:** PostgreSQL row locks execute sequentially per product ID. If `affected_rows == 0`, the transaction fails deterministically. There is zero possibility of overselling regardless of network latency, process crashes, or async race conditions.
2. **Support for In-Memory Database / Direct Engine:** For localized automated testing without external infrastructure dependency, an in-memory/simulated atomic row engine mirrors exact SQL conditional update semantics with atomic lock isolation.
3. **Idempotency Protection:** Combined with a dedicated `reservations` table and unique `idempotency_key` indices, re-submitted requests with the same key safely return the previously generated reservation payload.

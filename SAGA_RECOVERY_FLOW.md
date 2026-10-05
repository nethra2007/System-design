# SALESTORM SENTINEL: Payment & Order Event-Driven Saga & Recovery Architecture

## 1. Event-Driven Distributed Transaction Model (Saga Pattern)

SALESTORM SENTINEL shuns 2PC (Two-Phase Commit) or distributed locks across microservices in favor of an **Asynchronous Choreography/Orchestration Saga** backed by persistent event logs (**Redis Streams**).

```
[Checkout / Reservation] 
       │
       ▼ (gRPC / Sync)
  RESERVED
       │
       ▼
 [Payment Service] ──────(Idempotency Key Check)──────► [Payment Gateway Simulator]
       │                                                         │
       ├───────────────── SUCCESS ───────────────────────────────┤
       │                                                         │
       ▼                                                         ▼
Publish: PaymentSucceededEvent                            Publish: PaymentFailedEvent
       │                                                         │
       ▼                                                         ▼
 [Event Bus (Redis Streams)]                               [Inventory Service]
       │                                                         │
       ├─── Consumer Group: Order Service                        └─► RELEASE Stock
       │         │
       │         ├──► Success: Order Created
       │         │
       │         └──► Failure / Outage: Stream ACK withheld
       │                  │
       │                  └─► Automatic Stream Replay when Order Svc Recovers
       │
       └─── Consumer Group: Notification Service
                 │
                 └─► Send Email / SMS Confirmation
```

---

## 2. Recovery & Reconciliation Protocols

### A. Payment Success + Order Service Outage
- **Mechanism:** Redis Streams Consumer Groups with explicit Acknowledgments (`XACK`).
- **Flow:**
  1. `PaymentSucceededEvent` is published to `stream:payment_events`.
  2. Order Service attempts to process the event. If Order Service is down/crashed, the message remains unacknowledged in the **Pending Entries List (PEL)**.
  3. Upon Order Service recovery, it queries pending messages (`XREADGROUP`) and processes remaining unacknowledged events to create missing orders.

### B. Payment Gateway Failure / Timeout
- **Mechanism:** Resilience4j / Circuit Breaker + Retries with Exponential Backoff.
- **Flow:**
  1. Payment Gateway adapter wraps third-party API calls in a Circuit Breaker (Closed $\rightarrow$ Open state if error rate $> 50\%$).
  2. Timeout errors (e.g. 500ms API threshold) emit a `PaymentFailedEvent`.
  3. Inventory Service consumes `PaymentFailedEvent` and atomically releases reserved stock back to the available pool.

### C. Idempotency Guarantees
- **Payment Processing:** Keyed by `idempotency_key`. A repeated payment call returns the existing payment record without contacting the gateway twice or double-charging.
- **Order Creation:** Keyed by `payment_transaction_id` or `reservation_id`. If an event is replayed multiple times by Redis Streams, Order Service detects existing `order_id` and ignores duplicates safely.

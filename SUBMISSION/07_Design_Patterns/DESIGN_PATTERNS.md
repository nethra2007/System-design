# SALESTORM SENTINEL: Design Patterns Justification & Mapping

This document details every design pattern applied in **SALESTORM SENTINEL** with explicit justification: **Problem**, **Pattern**, **Implementation Location**, **Benefit**, and **Trade-off**.

---

## 1. Strategy Pattern

- **PROBLEM:** Different payment gateways (or simulation modes like SUCCESS, FAILURE, TIMEOUT) require different execution behaviors without polluting domain logic with `if/else` conditions.
- **PATTERN:** **Strategy Pattern**
- **IMPLEMENTATION LOCATION:** [`src/payment-gateway.adapter.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/payment-gateway.adapter.ts) (`IPaymentGatewayAdapter` interface with `SimulatedPaymentGatewayAdapter` implementation).
- **BENEFIT:** Allows runtime injection of different payment strategies (Stripe, Razorpay, Mock Simulator) without modifying `PaymentService`.
- **TRADE-OFF:** Requires defining separate interface abstractions and adapter classes.

---

## 2. Adapter Pattern

- **PROBLEM:** Third-party Payment Gateway APIs have custom request/response schemas that do not match internal system transaction models.
- **PATTERN:** **Adapter Pattern**
- **IMPLEMENTATION LOCATION:** [`src/payment-gateway.adapter.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/payment-gateway.adapter.ts) (`SimulatedPaymentGatewayAdapter`).
- **BENEFIT:** Translates external gateway exceptions/timeouts into normalized domain responses (`GatewayPaymentResponse`).
- **TRADE-OFF:** Adds an additional translation layer in the payment execution path.

---

## 3. Circuit Breaker Pattern

- **PROBLEM:** When an external payment provider experiences an outage, repeated synchronous calls lead to cascading thread pool exhaustion and high latency.
- **PATTERN:** **Circuit Breaker Pattern**
- **IMPLEMENTATION LOCATION:** [`src/payment-gateway.adapter.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/payment-gateway.adapter.ts) (`circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN'`).
- **BENEFIT:** Immediately trips to `OPEN` state after consecutive failures, fast-failing traffic in sub-milliseconds without overloading external servers.
- **TRADE-OFF:** Calls fail immediately while the circuit is `OPEN`, requiring a reset or retry timer.

---

## 4. Repository Pattern

- **PROBLEM:** Coupling domain logic directly to SQL queries or Redis commands makes unit testing difficult and binds business code to specific database drivers.
- **PATTERN:** **Repository Pattern**
- **IMPLEMENTATION LOCATION:** [`src/inventory.repository.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/inventory.repository.ts), [`src/reservation.repository.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/reservation.repository.ts), [`src/payment.repository.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/payment.repository.ts), [`src/order.repository.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/order.repository.ts).
- **BENEFIT:** Encapsulates data persistence logic behind clean interfaces. Enables seamless switching between `InMemoryRepository` for testing and `PostgresRepository` for production.
- **TRADE-OFF:** Requires mapping between database records and domain entities.

---

## 5. Observer / Event-Driven Pattern (Pub/Sub)

- **PROBLEM:** Synchronous REST calls between Checkout, Order Creation, and Notifications cause tight coupling, slow response times, and failure cascades if downstream services fail.
- **PATTERN:** **Observer / Event-Driven Pattern**
- **IMPLEMENTATION LOCATION:** [`src/event-bus.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/event-bus.ts) (`InMemoryEventBus` simulating Redis Streams).
- **BENEFIT:** Decouples Payment execution from Order Creation. Order Service consumes `PaymentSucceededEvent` asynchronously, protecting the user's checkout experience from Order Service latency.
- **TRADE-OFF:** Requires managing eventual consistency and stream pending message logs (PEL).

---

## 6. Facade Pattern

- **PROBLEM:** The REST API controllers would become overly complex if forced to interact with multiple repositories, event buses, and payment adapters directly.
- **PATTERN:** **Facade Pattern**
- **IMPLEMENTATION LOCATION:** [`src/server.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/server.ts) (`createServer()` exposing clean REST endpoints over complex service clusters).
- **BENEFIT:** Provides a simple, unified HTTP interface for clients while concealing internal microservice interactions.
- **TRADE-OFF:** Hides underlying subsystem details from API consumers.

---

## 7. State Pattern / State Machine

- **PROBLEM:** Inventory reservations and orders progress through complex lifecycle transitions (`RESERVED` $\rightarrow$ `PAYMENT_PENDING` $\rightarrow$ `CONFIRMED` $\rightarrow$ `SOLD` or `RELEASED`) with strict invalid transition rules.
- **PATTERN:** **State Pattern / State Machine**
- **IMPLEMENTATION LOCATION:** [`src/reservation.service.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/reservation.service.ts) & [`src/order.service.ts`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/src/order.service.ts).
- **BENEFIT:** Enforces strict transition validation (e.g. an already `SOLD` or `RELEASED` reservation cannot be confirmed again).
- **TRADE-OFF:** Requires explicitly checking current state prior to executing status updates.

# SALESTORM SENTINEL: SOLID Principles Mapping

This document explicitly maps the five SOLID principles to concrete classes in the SALESTORM SENTINEL codebase.

---

## 1. Single Responsibility Principle (SRP)

> **Definition:** A class should have one, and only one, reason to change.

- **`InventoryRepository` (`src/inventory.repository.ts`):** 
  - *Single Responsibility:* Manages atomic data access and row-level inventory mutation rules (`atomicReserve`, `atomicRelease`, `atomicConfirmSale`). Does not handle HTTP routing, payment logic, or notifications.
- **`PaymentGatewayAdapter` (`src/payment-gateway.adapter.ts`):** 
  - *Single Responsibility:* Encapsulates external payment provider communication and circuit breaker states. Has zero awareness of internal DB schemas or order generation.
- **`ReservationService` (`src/reservation.service.ts`):**
  - *Single Responsibility:* Coordinates reservation state transitions, TTL expirations, and idempotency checks.

---

## 2. Open/Closed Principle (OCP)

> **Definition:** Software entities should be open for extension, but closed for modification.

- **`IPaymentGatewayAdapter` (`src/payment-gateway.adapter.ts`):** 
  - *OCP Application:* `PaymentService` relies on the `IPaymentGatewayAdapter` interface. If we replace the simulated gateway with Stripe, PayPal, or Razorpay, we create a new class `StripePaymentGatewayAdapter implements IPaymentGatewayAdapter` without modifying a single line of `PaymentService`.

---

## 3. Liskov Substitution Principle (LSP)

> **Definition:** Derived classes must be replaceable for their base types without altering system correctness.

- **`InMemoryInventoryRepository` & `PostgresInventoryRepository` (`src/inventory.repository.ts`):** 
  - *LSP Application:* Both implement `IInventoryRepository`. The business logic in `ReservationService` behaves identically whether injected with the in-memory testing repository or a production PostgreSQL repository.

---

## 4. Interface Segregation Principle (ISP)

> **Definition:** Clients should not be forced to depend upon interfaces that they do not use.

- **`IInventoryRepository` vs `IReservationRepository` (`src/inventory.repository.ts` & `src/reservation.repository.ts`):** 
  - *ISP Application:* Instead of creating a monolithic `IStockAndReservationRepository`, data access interfaces are segregated by domain. `InventoryService` only depends on `IInventoryRepository`, preventing unneeded coupling to reservation query methods.

---

## 5. Dependency Inversion Principle (DIP)

> **Definition:** High-level modules should not depend on low-level modules. Both should depend on abstractions.

- **`PaymentService` (`src/payment.service.ts`):** 
  - *DIP Application:* High-level domain logic (`PaymentService`) depends on constructor-injected abstractions (`IPaymentRepository`, `IPaymentGatewayAdapter`, `IEventBus`) rather than instantiating concrete repository classes directly:
  
  ```typescript
  constructor(
    private paymentRepo: IPaymentRepository,
    private gatewayAdapter: IPaymentGatewayAdapter,
    private eventBus: IEventBus
  ) {}
  ```

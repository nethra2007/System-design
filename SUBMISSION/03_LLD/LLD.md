# SALESTORM SENTINEL: Low-Level Design (LLD)

This document contains detailed **Class Diagrams**, **Sequence Diagrams**, and **State Diagrams** using Mermaid for the three core domains: **Inventory**, **Payment**, and **Order**.

---

## 1. Class Diagrams

```mermaid
classDiagram
    %% Interfaces
    class IInventoryRepository {
        <<interface>>
        +initProductInventory(productId: string, initialQuantity: number) Promise~InventoryRecord~
        +getInventory(productId: string) Promise~InventoryRecord~
        +atomicReserve(productId: string, quantity: number) Promise~boolean~
        +atomicRelease(productId: string, quantity: number) Promise~boolean~
        +atomicConfirmSale(productId: string, quantity: number) Promise~boolean~
    }

    class IReservationRepository {
        <<interface>>
        +createReservation(reservation: ReservationRecord) Promise~ReservationRecord~
        +getByIdempotencyKey(key: string) Promise~ReservationRecord~
        +getById(reservationId: string) Promise~ReservationRecord~
        +updateStatus(reservationId: string, status: ReservationStatus) Promise~ReservationRecord~
        +findExpiredReservations(now: Date) Promise~ReservationRecord[]~
    }

    class InventoryLockStrategy {
        <<interface>>
        +acquireLock(key: string) Promise~ReleaseFunction~
    }

    class IPaymentGatewayAdapter {
        <<interface>>
        +processPayment(req: GatewayPaymentRequest) Promise~GatewayPaymentResponse~
    }

    class IPpaymentRepository {
        <<interface>>
        +createPayment(record: PaymentTransactionRecord) Promise~PaymentTransactionRecord~
        +getByIdempotencyKey(key: string) Promise~PaymentTransactionRecord~
        +getByTransactionRef(ref: string) Promise~PaymentTransactionRecord~
        +updateStatus(ref: string, status: PaymentTxStatus) Promise~PaymentTransactionRecord~
    }

    class IOrderRepository {
        <<interface>>
        +createOrder(order: OrderRecord) Promise~OrderRecord~
        +getById(orderId: string) Promise~OrderRecord~
        +getByTransactionRef(ref: string) Promise~OrderRecord~
        +getByReservationId(reservationId: string) Promise~OrderRecord~
    }

    class IEventBus {
        <<interface>>
        +publish(streamName: string, eventType: string, payload: any) Promise~string~
        +subscribe(streamName: string, consumerGroup: string, consumerName: string, handler: Function) Promise~void~
        +getPendingMessages(streamName: string, consumerGroup: string, consumerName: string) Promise~Array~
    }

    %% Service Concrete Classes
    class InventoryService {
        -inventoryRepo: IInventoryRepository
        +setupInventory(productId: string, qty: number) Promise~InventoryRecord~
        +getInventory(productId: string) Promise~InventoryRecord~
    }

    class ReservationService {
        -inventoryRepo: IInventoryRepository
        -reservationRepo: IReservationRepository
        +reserve(req: ReserveRequest) Promise~ReserveResult~
        +markPaymentPending(reservationId: string) Promise~ReservationRecord~
        +confirmReservation(reservationId: string) Promise~ReservationRecord~
        +handlePaymentFailure(reservationId: string) Promise~ReservationRecord~
        +expireStaleReservations(now: Date) Promise~number~
    }

    class PaymentService {
        -paymentRepo: IPpaymentRepository
        -gatewayAdapter: IPaymentGatewayAdapter
        -eventBus: IEventBus
        +processPayment(params: ProcessPaymentParams) Promise~PaymentTransactionRecord~
    }

    class OrderService {
        -orderRepo: IOrderRepository
        -eventBus: IEventBus
        -reservationService: ReservationService
        -isServiceAvailable: boolean
        +handlePaymentSucceeded(payload: PaymentSucceededEventPayload) Promise~boolean~
        +recoverPendingEvents() Promise~number~
        +setAvailability(available: boolean) void
    }

    class SimulatedPaymentGatewayAdapter {
        -circuitBreakerState: string
        -consecutiveFailures: number
        +processPayment(req: GatewayPaymentRequest) Promise~GatewayPaymentResponse~
    }

    %% Relationships
    ReservationService --> IInventoryRepository
    ReservationService --> IReservationRepository
    InventoryService --> IInventoryRepository
    PaymentService --> IPpaymentRepository
    PaymentService --> IPaymentGatewayAdapter
    PaymentService --> IEventBus
    OrderService --> IOrderRepository
    OrderService --> IEventBus
    OrderService --> ReservationService
    SimulatedPaymentGatewayAdapter ..|> IPaymentGatewayAdapter
```

---

## 2. Sequence Diagrams

### Flash Sale Reserve & Payment Flow (Happy Path)

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant GW as API Gateway
    participant ResSvc as ReservationService
    participant InvRepo as InventoryRepository
    participant ResRepo as ReservationRepository
    participant PaySvc as PaymentService
    participant GwAdapter as PaymentGatewayAdapter
    participant EventBus as Redis Streams EventBus
    participant OrdSvc as OrderService

    Client->>GW: POST /api/v1/sale/PROD_1/reserve (X-Idempotency-Key)
    GW->>ResSvc: reserve(ReserveRequest)
    ResSvc->>ResRepo: getByIdempotencyKey(key)
    alt Idempotent Duplicate
        ResRepo-->>ResSvc: Existing ReservationRecord
        ResSvc-->>GW: Return Cached Reservation (IsDuplicate: true)
        GW-->>Client: 200 OK (Cached Payload)
    else New Request
        ResSvc->>InvRepo: atomicReserve(productId, qty)
        alt Stock Available
            InvRepo-->>ResSvc: true (Stock Decremented)
            ResSvc->>ResRepo: createReservation(RESERVED)
            ResRepo-->>ResSvc: ReservationRecord
            ResSvc-->>GW: ReserveResult (Success: true)
            GW-->>Client: 200 OK (ReservationId)
        else Out of Stock
            InvRepo-->>ResSvc: false
            ResSvc-->>GW: ReserveResult (Success: false, Reason: OUT_OF_STOCK)
            GW-->>Client: 409 Conflict (Out of Stock)
        end
    end

    Client->>GW: POST /api/v1/payments (ReservationId, IdempotencyKey)
    GW->>PaySvc: processPayment(params)
    PaySvc->>GwAdapter: processPayment(req)
    GwAdapter-->>PaySvc: GatewayPaymentResponse (SUCCESS)
    PaySvc->>EventBus: publish("PaymentSucceededEvent")
    PaySvc-->>GW: PaymentTransactionRecord (SUCCESS)
    GW-->>Client: 200 OK (TransactionRef)

    EventBus--)OrdSvc: Consume PaymentSucceededEvent
    OrdSvc->>OrdSvc: handlePaymentSucceeded()
    OrdSvc->>ResSvc: confirmReservation(reservationId)
    ResSvc->>InvRepo: atomicConfirmSale()
    OrdSvc->>EventBus: publish("OrderCreatedEvent")
```

---

## 3. State Diagrams

### A. Inventory Reservation Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> AVAILABLE : Stock Initialized (>0)
    AVAILABLE --> RESERVED : Atomic Reserve Request
    RESERVED --> PAYMENT_PENDING : User Initiates Checkout
    PAYMENT_PENDING --> CONFIRMED : Payment Succeeded
    CONFIRMED --> SOLD : Inventory Deducted Permanently

    RESERVED --> PAYMENT_FAILED : Gateway Failure / Card Declined
    PAYMENT_PENDING --> PAYMENT_FAILED : Payment Execution Error
    PAYMENT_FAILED --> RELEASED : Stock Restored to Available Pool

    RESERVED --> TIMEOUT : 10m TTL Expiration
    PAYMENT_PENDING --> TIMEOUT : Session Abandonment
    TIMEOUT --> RELEASED : Stock Restored to Available Pool

    RELEASED --> AVAILABLE : Re-added to Pool
    AVAILABLE --> OUT_OF_STOCK : Available Quantity == 0
    OUT_OF_STOCK --> [*]
```

### B. Payment Transaction State Machine

```mermaid
stateDiagram-v2
    [*] --> INITIATED : Payment Request Received
    INITIATED --> SUCCESS : Gateway Authorization Passed
    INITIATED --> FAILED : Card Declined / Bad Request
    INITIATED --> TIMEOUT : Gateway API Network Timeout

    SUCCESS --> [*] : Publish PaymentSucceededEvent
    FAILED --> [*] : Publish PaymentFailedEvent
    TIMEOUT --> [*] : Publish PaymentFailedEvent
```

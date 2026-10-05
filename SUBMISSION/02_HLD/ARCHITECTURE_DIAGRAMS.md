# SALESTORM SENTINEL Architecture Diagrams

This document contains full Mermaid diagrams for the **SALESTORM SENTINEL** flash-sale architecture.

---

## 1. System Context Diagram (C4 Level 1)

Visualizes the high-level boundary of SALESTORM SENTINEL, its end users, and third-party integrations.

```mermaid
graph TB
    User["👤 Customer<br>[Web / Mobile Client]"]
    
    subgraph SystemBoundary["SALESTORM SENTINEL SYSTEM"]
        Sentinel["⚡ SALESTORM SENTINEL<br>Flash Sale Platform<br>(High-concurrency E-commerce Platform)"]
    end
    
    ExtPayment["💳 External Payment Gateway Simulator<br>(Third-Party Gateway API)"]
    NotificationChannels["📱 External Push / Email / SMS Provider"]

    User -- "Browses products, places flash-sale orders,<br>makes payments (HTTPS/WSS)" --> Sentinel
    Sentinel -- "Processes payments,<br>handles authorizations (REST / HTTPS)" --> ExtPayment
    Sentinel -- "Dispatches push notifications,<br>SMS & confirmation emails" --> NotificationChannels
```

---

## 2. High-Level Architecture Diagram

Overview of all components, sync/async flows, cache usage, databases, and event bus boundaries.

```mermaid
graph TB
    Client["📱 Client<br>[Mobile / Web App]"]
    CDN["🛡️ Cloudflare CDN / WAF"]
    LB["⚖️ Load Balancer<br>[NGINX / ALB]"]
    GW["🚪 API Gateway<br>[Envoy / Kong]<br><i>(Idempotency Filter)</i>"]

    subgraph ServiceLayer["Microservices Cluster"]
        ProdSvc["🛍️ Product / Sale Service"]
        CartSvc["🛒 Cart Service"]
        InvSvc["📦 Inventory & Reservation Service<br><b>[CRITICAL INVENTORY BOUNDARY]</b>"]
        ChkSvc["⚡ Checkout Service"]
        PaySvc["💳 Payment Service"]
        OrdSvc["📜 Order Service"]
        NotifSvc["🔔 Notification Service"]
    end

    subgraph StorageLayer["Data & Caching Layer"]
        RedisCache[("⚡ Redis Cache & Counter<br>(Stock Pre-check & Lock)")]
        RedisStreams[("🌊 Redis Streams / Event Bus")]
        PostgresDB[("🐘 PostgreSQL Cluster<br>(Service Databases)")]
    end

    ExtPayment["💳 External Payment Gateway Simulator"]
    Obs["📊 Observability Layer<br>[Prometheus + Grafana + OpenTelemetry]"]

    %% Sync Calls
    Client -->|"HTTPS"| CDN
    CDN --> LB
    LB --> GW
    GW -->|"Sync HTTP/gRPC"| ProdSvc
    GW -->|"Sync HTTP/gRPC"| CartSvc
    GW -->|"Sync HTTP/gRPC"| ChkSvc
    ChkSvc -->|"1. Atomic Stock Reserve (Sync)"| InvSvc

    %% Cache Interactions
    ProdSvc <-->|"Read/Write Catalog Cache"| RedisCache
    CartSvc <-->|"Cart Session State"| RedisCache
    InvSvc <-->|"Fast Lua Stock Shedding"| RedisCache

    %% DB Storage Ownership
    ProdSvc --->|"DB Ownership"| PostgresDB
    CartSvc --->|"DB Ownership"| PostgresDB
    InvSvc --->|"Atomic SQL Update Assertion"| PostgresDB
    OrdSvc --->|"DB Ownership"| PostgresDB
    PaySvc --->|"DB Ownership"| PostgresDB

    %% Async Event Driven Path
    ChkSvc -- "2. Publish CheckoutInitiated" --> RedisStreams
    RedisStreams -- "Consume CheckoutInitiated" --> PaySvc
    PaySvc <-->|"Sync API Call"| ExtPayment
    PaySvc -- "3. Publish PaymentSucceeded / PaymentFailed" --> RedisStreams
    RedisStreams -- "Consume PaymentFailed (Release Stock)" --> InvSvc
    RedisStreams -- "Consume PaymentSucceeded (Create Order)" --> OrdSvc
    OrdSvc -- "4. Publish OrderCreated" --> RedisStreams
    RedisStreams -- "Consume OrderCreated" --> NotifSvc

    %% Observability
    ServiceLayer -.->|"Metrics / Traces / Logs"| Obs
```

---

## 3. Container Diagram (C4 Level 2)

Shows application containers, datastores, protocols, and queue boundaries.

```mermaid
graph TB
    subgraph ClientContainer["Client Tier"]
        ClientApp["Single Page App / Mobile App<br>[React / Flutter]"]
    end

    subgraph EdgeTier["Edge Security & Routing Tier"]
        WAF["WAF & CDN Edge<br>[Cloudflare]"]
        ALB["Application Load Balancer<br>[AWS ALB / NGINX]"]
        APIGW["API Gateway Container<br>[Kong / Envoy]<br><i>Rate Limit & Idempotency Check</i>"]
    end

    subgraph ApplicationServices["Application Microservice Containers"]
        ProductContainer["Product Service Container<br>[Go / Node.js]"]
        CartContainer["Cart Service Container<br>[Go / Node.js]"]
        InventoryContainer["Inventory Service Container<br>[Go / Rust]<br><b>Single Point of Inventory Truth</b>"]
        CheckoutContainer["Checkout Service Container<br>[Go / Node.js]"]
        PaymentContainer["Payment Service Container<br>[Go / Node.js]"]
        OrderContainer["Order Service Container<br>[Go / Java]"]
        NotifContainer["Notification Service Container<br>[Node.js / Go]"]
    end

    subgraph PersistenceLayer["Datastores & Message Brokers"]
        RedisStore[("Redis Cluster Container<br>[Master-Replica]<br>- Stock Counters<br>- Distributed Locks<br>- Session State")]
        StreamBroker[("Redis Streams Container<br>[Event Bus / Message Queue]<br>- Event Persistence<br>- Consumer Groups")]
        DBProduct[("PostgreSQL: Product DB")]
        DBInventory[("PostgreSQL: Inventory DB<br><b>Row-Level Lock Assertions</b>")]
        DBOrder[("PostgreSQL: Order DB")]
        DBPayment[("PostgreSQL: Payment DB")]
    end

    ExtPay["External Payment Gateway API"]

    %% Connectors
    ClientApp -->|"HTTPS / TLS 1.3"| WAF
    WAF --> ALB
    ALB --> APIGW

    APIGW -->|"HTTP/2 REST"| ProductContainer
    APIGW -->|"HTTP/2 REST"| CartContainer
    APIGW -->|"HTTP/2 REST"| CheckoutContainer

    CheckoutContainer -->|"gRPC (Sync)"| InventoryContainer
    
    InventoryContainer <-->|"Redis Lua Scripts (Shedding)"| RedisStore
    InventoryContainer <-->|"SQL Row Lock Assertion (ACID)"| DBInventory
    ProductContainer <-->|"Read Cache"| RedisStore
    ProductContainer <-->|"SQL"| DBProduct
    CartContainer <-->|"Session Storage"| RedisStore

    CheckoutContainer -->|"Publish Events"| StreamBroker
    StreamBroker -->|"Consumer Group"| PaymentContainer
    PaymentContainer <-->|"SQL"| DBPayment
    PaymentContainer <-->|"HTTPS API Call"| ExtPay
    PaymentContainer -->|"Publish Payment Status"| StreamBroker

    StreamBroker -->|"Consumer Group"| OrderContainer
    OrderContainer <-->|"SQL"| DBOrder
    OrderContainer -->|"Publish OrderCreated"| StreamBroker

    StreamBroker -->|"Consumer Group"| NotifContainer
```

---

## 4. Component Diagram (C4 Level 3 - Inventory & Checkout Focus)

Internal sub-components detailing **Where overselling is prevented**, **Idempotency**, and **Failure boundaries**.

```mermaid
graph TB
    subgraph CheckoutServiceComponent["Checkout Service Component"]
        ChkAPI["Checkout REST Controller"]
        IdempotencyFilter["Idempotency Filter Manager"]
        Orchestrator["Checkout Orchestrator"]
        EventPublisher["Event Publisher Module"]
    end

    subgraph InventoryServiceComponent["Inventory & Reservation Service Component"]
        InvAPI["Inventory gRPC Handler"]
        LuaExecutor["Redis Lua High-Speed Shedder"]
        ReservationManager["DB Reservation Engine"]
        ExpirySweeper["Background Reservation Expiry Worker"]
    end

    subgraph IdempotencyStorage["Redis Infrastructure"]
        RedisLock[("Redis Distributed Cache / Lock")]
    end

    subgraph DBBoundary["PostgreSQL Database Component"]
        InvTable[("Inventory Table<br>--------------------<br>product_id (PK)<br>available_quantity (INT)<br>reserved_quantity (INT)<br>version (BIGINT)")]
        ResTable[("Reservations Table<br>--------------------<br>reservation_id (UUID)<br>status (PENDING/CONFIRMED/EXPIRED)")]
    end

    %% Internal Component Flow
    ChkAPI --> IdempotencyFilter
    IdempotencyFilter <-->|"Check / Store Idempotency Key"| RedisLock
    IdempotencyFilter --> Orchestrator
    Orchestrator -->|"Sync gRPC Reserve Request"| InvAPI
    
    InvAPI --> LuaExecutor
    LuaExecutor <-->|"1. Sub-ms Fast DECRBY Check"| RedisLock
    LuaExecutor -- "If Redis > 0 (Pass Traffic)" --> ReservationManager
    LuaExecutor -- "If Redis <= 0 (Reject Immediately)" --> InvAPI

    ReservationManager <-->|"2. ATOMIC SQL UPDATE ASSERTION<br>WHERE (available - reserved) >= qty"| InvTable
    ReservationManager <-->|"3. Record Reservation (PENDING)"| ResTable

    Orchestrator --> EventPublisher
    EventPublisher -->|"Publish CheckoutInitiated"| EventBus[("Redis Streams Event Bus")]

    ExpirySweeper <-->|"Release Stale PENDING Reservations (>10m)"| ResTable
    ExpirySweeper <-->|"Decrement reserved_quantity"| InvTable
```

---

## 5. Deployment Diagram

Infrastructure deployment across Cloud Provider Availability Zones, Auto-Scaling Groups, and Kubernetes Clusters.

```mermaid
graph TB
    subgraph CloudProvider["AWS / Cloud Environment"]
        subgraph EdgeLayer["Edge / Ingress Infrastructure"]
            CDNEdge["Cloudflare CDN & WAF"]
            Route53["DNS / Global Traffic Manager"]
        end

        subgraph VPC["Virtual Private Cloud (VPC) - 10.0.0.0/16"]
            
            subgraph PublicSubnetAZ1["Public Subnet AZ-1"]
                ALB1["AWS Application Load Balancer"]
            end
            
            subgraph K8sCluster["EKS Kubernetes Cluster (Auto-Scaling Node Group)"]
                
                subgraph IngressPods["Ingress Pods"]
                    EnvoyPods["Envoy API Gateway Pods<br>[Horizontal Pod Autoscaler 5-50 Pods]"]
                end
                
                subgraph AppPods["Application Microservice Pods"]
                    CheckoutPods["Checkout Service Pods<br>[HPA: 10-100 Pods]"]
                    InventoryPods["Inventory Service Pods<br>[HPA: 10-100 Pods]"]
                    PaymentPods["Payment Worker Pods<br>[HPA: 5-50 Pods]"]
                    OrderPods["Order Service Pods<br>[HPA: 5-30 Pods]"]
                end
            end

            subgraph DataSubnetAZ1["Private Data Subnet AZ-1 (Primary)"]
                RedisPrimary[("Redis Cluster Primary Node<br>[ElastiCache]")]
                PGPrimary[("PostgreSQL Primary DB<br>[RDS Multi-AZ Writer]")]
            end

            subgraph DataSubnetAZ2["Private Data Subnet AZ-2 (Standby)"]
                RedisReplica[("Redis Cluster Replica Node<br>[ElastiCache Reader]")]
                PGStandby[("PostgreSQL Standby DB<br>[RDS Multi-AZ Reader]")]
            end
        end

        ExtPaymentAPI["💳 External Payment Gateway Server"]
    end

    %% Network Connections
    Route53 --> CDNEdge
    CDNEdge --> ALB1
    ALB1 --> EnvoyPods
    EnvoyPods --> CheckoutPods
    EnvoyPods --> InventoryPods
    
    CheckoutPods --> RedisPrimary
    InventoryPods --> RedisPrimary
    InventoryPods --> PGPrimary

    PaymentPods --> ExtPaymentAPI
    PaymentPods --> PGPrimary
    OrderPods --> PGPrimary

    PGPrimary -.->|"Synchronous / Semi-Sync Replication"| PGStandby
    RedisPrimary -.->|"Async Replication"| RedisReplica
```

---

## 6. Summary of Architectural Design Guarantees

| Design Aspect | Implementation Details |
| :--- | :--- |
| **Preventing Overselling** | **Single Point of Truth:** PostgreSQL atomic row update `WHERE (available_quantity - reserved_quantity) >= :qty`. Dropped by Redis if stock counter hits 0. |
| **High Concurrency Support** | 10,000 requests shed to 100 requests in sub-milliseconds via Redis Lua pre-reservation before reaching DB lock engine. |
| **Idempotency** | Keyed by `X-Idempotency-Key` headers saved in Redis with distributed locking during transaction execution. |
| **Asynchronous Order Processing** | Payments and order generation happen asynchronously via partitioned Redis Streams, preventing DB write spikes during peak checkout. |
| **Fault Resilience** | Circuit breakers on external gateways, event replay from streams on service outages, and background expiry workers for payment timeouts. |

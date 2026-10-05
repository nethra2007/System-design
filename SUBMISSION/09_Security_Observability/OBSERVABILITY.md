# SALESTORM SENTINEL: Observability & Distributed Tracing Specification

## 1. End-to-End Tracing Architecture

Every incoming request is injected with a unique **`X-Correlation-ID`** at the API Gateway. This ID is propagated across all HTTP headers, gRPC metadata, Redis Stream event payloads, structured JSON log contexts, and PostgreSQL query tags.

```
Client (X-Correlation-ID: corr-12345)
  │
  ├─► API Gateway (Injects / Forwards corr-12345)
  │     │
  │     ├─► Inventory Service (Log [corr-12345]: Stock Decremented)
  │     │
  │     └─► Payment Service (Log [corr-12345]: Gateway Invoked)
  │           │
  │           └─► Redis Stream Event Payload Header: { correlationId: "corr-12345" }
  │                 │
  │                 └─► Order Service Consumer (Log [corr-12345]: Order Created)
```

---

## 2. Structured JSON Logging Contract

All microservices log strictly to stdout using structured JSON format:

```json
{
  "timestamp": "2026-10-05T10:55:00.123Z",
  "level": "INFO",
  "service": "inventory-service",
  "correlationId": "corr-8f92a1b3",
  "requestId": "req-991204",
  "traceId": "trace-4a11c",
  "action": "ATOMIC_STOCK_RESERVATION",
  "productId": "PRODUCT_X",
  "details": {
    "requestedQty": 1,
    "availableQty": 99,
    "reservedQty": 1,
    "durationMs": 2.4
  }
}
```

---

## 3. Real-Time Prometheus Metrics & Alert Definitions

### Key Telemetry Metrics
- `salestorm_http_requests_total{endpoint, status}` — Incoming RPS & error rates.
- `salestorm_http_request_duration_ms{quantile="0.95"}` — Latency percentiles (P95, P99).
- `salestorm_inventory_stock_gauge{product_id, type="available"}` — Real-time stock depth.
- `salestorm_redis_stream_pending_events{stream="payment_events"}` — Event bus backlog length.

### Automated System Alerts
1. **Inventory Inconsistency Alert:** Triggered if `reserved_quantity + sold_quantity > total_quantity` (Severity: CRITICAL).
2. **Payment Failure Rate Alert:** Triggered if payment failure rate exceeds 15% in 1 minute (Severity: WARNING).
3. **Event Backlog Alert:** Triggered if Redis Stream unacknowledged pending messages exceed 100 (Severity: WARNING).

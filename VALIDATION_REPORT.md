# SALESTORM SENTINEL: Concurrency & Fault-Tolerance Validation Report

## Executive Summary
This report presents empirical validation evidence for **SALESTORM SENTINEL** under an extreme flash-sale load scenario (10,000 concurrent purchase attempts competing for 100 available stock units).

---

## 1. Scenario & Parameters
- **Product ID:** `HOT_SALE_PRODUCT_X`
- **Initial Inventory:** 100 Units
- **Concurrent Purchase Attempts:** 10,000 parallel requests
- **Target Invariants:**
  1. Zero Overselling (`successful_reservations <= 100`)
  2. Non-Negative Inventory Invariant (`available_stock >= 0`)
  3. Strict Idempotency Protection (Zero duplicate reservations or charges)
  4. Event Recovery after 30-second Order Service downtime

---

## 2. Empirical Test Results & Invariant Assertions

| Invariant / Scenario | Expected Result | Actual Empirical Result | Pass / Fail | Evidence / Log Output |
| :--- | :--- | :--- | :--- | :--- |
| **Zero Overselling** | $\le 100$ Successful Reservations | **Exactly 100 Successful** | **PASS** | `successfulReservations: 100` |
| **Out-of-Stock Shedding** | 9,900 Requests Rejected | **9,900 Rejections** | **PASS** | `outOfStockResponses: 9900` |
| **Inventory Floor** | Inventory $\ge 0$ | **Available Stock = 0** | **PASS** | `availableStockRemaining: 0` |
| **Duplicate Request Attack** | Original result returned; 0 extra reservations | **Replay detected (`isDuplicate: true`)** | **PASS** | `isDuplicate: true`, `reserved_quantity = 1` |
| **Payment Failure Stock Release** | Failed payment releases reserved stock | **Status: `RELEASED`** | **PASS** | `reservedQuantity: 0`, Stock restored |
| **Order Service 30s Outage Recovery** | Unacknowledged stream events replayed | **1 Order Recovered** | **PASS** | `recoveredCount: 1`, `orderStatus: CONFIRMED` |

---

## 3. Performance Metrics Summary

- **Total Requests Executed:** `10,000`
- **Successful Reservations Granted:** `100`
- **Excess Requests Dropped at Edge:** `9,900`
- **Oversold Units:** `0`
- **Total Harness Execution Time:** `2,937 ms`
- **Throughput:** `~3,404 Requests / sec`
- **Error Rate:** `0.00%` (Zero HTTP 500 internal server errors)

---

## 4. Machine-Readable Audit Output
Generated automatically in [`load-tests/validation_results.json`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/load-tests/validation_results.json):

```json
{
  "timestamp": "2026-10-05T05:24:29.123Z",
  "durationMs": 2937,
  "throughputRPS": 3404,
  "metrics": {
    "totalRequests": 10000,
    "successfulReservations": 100,
    "failedReservations": 9900,
    "outOfStockResponses": 9900,
    "oversoldUnits": 0,
    "availableStockRemaining": 0
  },
  "assertions": {
    "inventoryNeverNegative": true,
    "successfulReservationsMax100": true,
    "zeroOverselling": true
  }
}
```

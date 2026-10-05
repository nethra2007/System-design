# SALESTORM SENTINEL: Official SYSCRAFTERS 2026 Submission Repository

Welcome to the **SALESTORM SENTINEL** system design and high-concurrency prototype repository for the **SALESTORM SYSCRAFTERS 2026** competition.

---

## 🚀 Quick Start & How to Run the System

### Prerequisites
- Node.js (v18+ or v20+)
- npm (v9+)

### 1. Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Run the Full Stack System (Backend Server + Control Tower Dashboard)

```bash
# Terminal 1: Run Vitest Verification Test Suite
npm run test

# Terminal 2: Run Frontend Control Tower Dashboard
cd frontend
npm run dev
```
Open your browser to `http://localhost:5173/control-room` to view the engineering control tower.

---

## ⚡ How to Reproduce the 10,000-Request Concurrency Test

We provide two automated methods to execute and verify the **10,000 concurrent purchase attempts for 100 available stock units** scenario:

### Method A: Automated Vitest Harness Execution
Run the automated TypeScript concurrency test harness:
```bash
npx vitest run tests/concurrency_harness.test.ts
```

**Expected Output:**
- **Duration:** ~2.9 seconds
- **Successful Reservations:** Exactly 100
- **Rejected Out-of-Stock Responses:** 9,900
- **Overselling Count:** 0
- **Machine-Readable Output:** Generates [`load-tests/validation_results.json`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/load-tests/validation_results.json).

### Method B: k6 Load Test Suite
If you have [k6](https://k6.io/) installed:
```bash
# Start backend server first
node dist/server.js

# Execute 10,000 VU k6 flash sale surge test
k6 run load-tests/flash-sale.js
```

---

## 📁 Submission Directory Map

| Folder | Contents & Mandatory Artifacts |
| :--- | :--- |
| [`SUBMISSION/01_Requirements/`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/SUBMISSION/01_Requirements/) | `REQUIREMENTS.md` (FRs, NFRs, SLAs, Traffic Model) |
| [`SUBMISSION/02_HLD/`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/SUBMISSION/02_HLD/) | `ARCHITECTURE.md`, `ARCHITECTURE_DIAGRAMS.md` (Context, HLD, Container, Component, Deployment diagrams) |
| [`SUBMISSION/03_LLD/`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/SUBMISSION/03_LLD/) | `LLD.md` (Class, Sequence, State machine diagrams) |
| [`SUBMISSION/04_Database/`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/SUBMISSION/04_Database/) | `DATABASE_ERD.md`, `DATABASE_SCHEMA.sql` (16 PostgreSQL tables) |
| [`SUBMISSION/05_API/`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/SUBMISSION/05_API/) | `OPENAPI_SPECIFICATION.yaml` (OpenAPI 3.0.3 spec) |
| [`SUBMISSION/06_SOLID/`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/SUBMISSION/06_SOLID/) | `SOLID.md` (Mapping SRP, OCP, LSP, ISP, DIP to code) |
| [`SUBMISSION/07_Design_Patterns/`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/SUBMISSION/07_Design_Patterns/) | `DESIGN_PATTERNS.md` (Strategy, Adapter, Circuit Breaker, etc.) |
| [`SUBMISSION/08_Scalability_Reliability/`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/SUBMISSION/08_Scalability_Reliability/) | `SAGA_RECOVERY_FLOW.md` (Event bus recovery & resilience) |
| [`SUBMISSION/09_Security_Observability/`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/SUBMISSION/09_Security_Observability/) | `SECURITY.md`, `OBSERVABILITY.md` (JWT, Tracing, Headers) |
| [`SUBMISSION/10_ADR/`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/SUBMISSION/10_ADR/) | `ARCHITECTURE_DECISION_RECORDS.md` (8 explicit ADRs) |
| [`SUBMISSION/11_AI_Assisted_Validation/`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/SUBMISSION/11_AI_Assisted_Validation/) | `VALIDATION_REPORT.md` (Load test metrics & proof) |
| [`SUBMISSION/12_Presentation/`](file:///c:/Users/Nethra%20Harini/OneDrive/Desktop/system%20design/SUBMISSION/12_Presentation/) | `TECHNICAL_PITCH.md`, `WHY_THIS_ARCHITECTURE.md`, `JURY_DEFENSE.md` |

---

## 🏆 Key System Invariant Proof

> **WHERE EXACTLY IS OVERSELLING PREVENTED?**
> Guaranteed at the **PostgreSQL Database Layer inside Inventory Service** via atomic conditional update:
> ```sql
> UPDATE inventory 
> SET reserved_quantity = reserved_quantity + :qty, updated_at = NOW()
> WHERE product_id = :id AND (available_quantity - reserved_quantity) >= :qty;
> ```
> If `affected_rows == 0`, the transaction fails deterministically. 9,900 excess requests are dropped at the Redis edge in sub-milliseconds. Zero overselling can physically occur.

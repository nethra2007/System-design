# SALESTORM SENTINEL: Project Implementation Plan

## Phase 1: Architecture & Design Foundation (Current Phase)
- **Status:** Completed / In Progress
- **Deliverables:**
  - `ARCHITECTURE_PRINCIPLES.md`
  - `REQUIREMENTS.md`
  - `ARCHITECTURE_DECISIONS.md`
  - `ARCHITECTURE.md`
  - `ARCHITECTURE_DIAGRAMS.md`
  - `PROJECT_PLAN.md`

## Phase 2: Data Models, API Contracts & Event Schemas
- **Objective:** Define exact interface specifications before writing runtime code.
- **Deliverables:**
  - `API_SPECIFICATION.md` (REST & gRPC endpoints)
  - `EVENT_SCHEMAS.md` (Payload contracts for Redis Streams)
  - `DATABASE_SCHEMA.sql` (PostgreSQL schemas, indexes, and constraint assertions)

## Phase 3: Core Prototype Implementation (Minimal & Demonstrable)
- **Objective:** Build a lightweight, runnable prototype targeting the 10,000 requests vs 100 units test.
- **Components:**
  - `API Gateway` (Rate Limiter & Idempotency filter)
  - `Inventory & Reservation Service` (Redis Lua pre-check + Atomic SQL UPDATE)
  - `Checkout & Payment Service` (Idempotent worker + Payment Gateway Simulator)
  - `Order Service` (Event consumer + Lifecycle manager)
  - `External Payment Gateway Simulator` (Simulates success, failure, timeout)

## Phase 4: Verification, Simulation & Metrics
- **Objective:** Validate all 12 hackathon criteria with real traffic simulation scripts.
- **Deliverables:**
  - `k6` / `Locust` load testing script (Simulates 10,000 concurrent checkout attempts)
  - Verification test suite covering:
    1. Zero Overselling Assertion (`reserved + sold == 100`)
    2. Duplicate Request / Idempotency Check
    3. Payment Timeout & Expiry Release Verification
    4. Order Service Outage Event Replay Verification

## Phase 5: Demo & Hackathon Submission Package
- **Deliverables:**
  - System architecture presentation summary
  - Automated test runner script (`run_verification.sh` / `powershell`)

# SALESTORM SENTINEL: Security Architecture Specification

## 1. Security Overview & Invariants

SALESTORM SENTINEL is built with enterprise defense-in-depth principles to protect against botnet attacks, inventory manipulation, duplicate charges, and data leaks during high-concurrency flash sales.

---

## 2. Security Implementations

### A. Authentication & Role-Based Access Control (RBAC)
- **Customer Authentication:** JWT (JSON Web Token) with RS256 signature verification passed via `Authorization: Bearer <token>`.
- **Role Enforcement:**
  - `ROLE_CUSTOMER`: Access to `/api/v1/sale/*`, `/api/v1/checkout`, `/api/v1/orders/*`.
  - `ROLE_ADMIN`: Exclusive access to `/api/v1/admin/*` failure simulation controls and system management endpoints.

### B. Ingress Rate Limiting & Bot Mitigation
- **Token Bucket Algorithm:** Enforced at API Gateway per IP address and Customer ID.
- **Limits:** 5 requests per second per IP for standard endpoints; 1 request per second for flash-sale checkout endpoints.
- **HTTP 429 Too Many Requests:** Fast-fails bot traffic at the gateway before hitting backend services.

### C. Input Validation & Parameter Sanitization
- **Strict Schema Enforcement:** All API payloads validated against OpenAPI schemas using Zod/Joi before execution.
- **UUID Format Validation:** All `productId`, `reservationId`, `orderId`, and `customerId` fields strictly checked for valid UUID v4 format to prevent SQL injection or path traversal attacks.

### D. Secure HTTP Headers (Helmet Integration)
- `Strict-Transport-Security` (HSTS): `max-age=31536000; includeSubDomains`
- `X-Content-Type-Options`: `nosniff`
- `X-Frame-Options`: `DENY`
- `Content-Security-Policy`: Restricts scripts, styles, and iframe embeds.

### E. Payment Data Protection (PCI-DSS Compliance Boundary)
- **Tokenization:** Raw Credit Card numbers (PAN) or CVVs are **NEVER stored, logged, or processed** by SALESTORM SENTINEL microservices.
- Payments rely strictly on single-use token references (`transaction_reference`, `provider_reference`) supplied by the payment gateway provider.

### F. Environment Secret Management
- Zero hardcoded secrets in codebase.
- Configuration loaded dynamically via `.env` / Environment variables:
  - `DATABASE_URL`
  - `REDIS_URL`
  - `JWT_SECRET_KEY`
  - `PAYMENT_GATEWAY_API_KEY`

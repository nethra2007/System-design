-- SALESTORM SENTINEL: Comprehensive Database Schema & Migration Definitions
-- Target: PostgreSQL 14+

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CUSTOMER TABLE
CREATE TABLE customer (
    customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. CATEGORY TABLE
CREATE TABLE category (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. PRODUCT TABLE
CREATE TABLE product (
    product_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES category(category_id) ON DELETE SET NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. INVENTORY TABLE
CREATE TABLE inventory (
    inventory_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL UNIQUE REFERENCES product(product_id) ON DELETE CASCADE,
    available_quantity INT NOT NULL CHECK (available_quantity >= 0),
    reserved_quantity INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    sold_quantity INT NOT NULL DEFAULT 0 CHECK (sold_quantity >= 0),
    version BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT check_total_inventory CHECK (available_quantity >= reserved_quantity + sold_quantity)
);

CREATE INDEX idx_inventory_product_id ON inventory(product_id);

-- 5. INVENTORY_RESERVATION TABLE
CREATE TABLE inventory_reservation (
    reservation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID NOT NULL REFERENCES inventory(inventory_id) ON DELETE CASCADE,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customer(customer_id),
    quantity INT NOT NULL CHECK (quantity > 0),
    status VARCHAR(50) NOT NULL CHECK (status IN ('RESERVED', 'PAYMENT_PENDING', 'CONFIRMED', 'SOLD', 'PAYMENT_FAILED', 'TIMEOUT', 'RELEASED')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_reservation_idempotency ON inventory_reservation(idempotency_key);
CREATE INDEX idx_reservation_status_expires ON inventory_reservation(status, expires_at);

-- 6. CART TABLE
CREATE TABLE cart (
    cart_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL UNIQUE REFERENCES customer(customer_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 7. CART_ITEM TABLE
CREATE TABLE cart_item (
    cart_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES cart(cart_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES product(product_id),
    quantity INT NOT NULL CHECK (quantity > 0),
    CONSTRAINT unique_cart_product UNIQUE (cart_id, product_id)
);

-- 8. ORDER TABLE
CREATE TABLE "order" (
    order_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customer(customer_id),
    reservation_id UUID UNIQUE REFERENCES inventory_reservation(reservation_id),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(50) NOT NULL CHECK (status IN ('CREATED', 'CONFIRMED', 'CANCELLED', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_order_customer ON "order"(customer_id);

-- 9. ORDER_ITEM TABLE
CREATE TABLE order_item (
    order_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES "order"(order_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES product(product_id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0)
);

-- 10. PAYMENT TABLE
CREATE TABLE payment (
    payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES "order"(order_id) ON DELETE CASCADE,
    transaction_reference VARCHAR(255) NOT NULL UNIQUE,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('INITIATED', 'SUCCESS', 'FAILED', 'TIMEOUT')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    provider_reference VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_payment_tx_ref ON payment(transaction_reference);
CREATE INDEX idx_payment_idempotency ON payment(idempotency_key);

-- 11. SALE TABLE
CREATE TABLE sale (
    sale_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES product(product_id),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    discount_price NUMERIC(12, 2) NOT NULL CHECK (discount_price >= 0),
    status VARCHAR(50) NOT NULL CHECK (status IN ('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 12. COUPON TABLE
CREATE TABLE coupon (
    coupon_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sale(sale_id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_amount NUMERIC(12, 2) NOT NULL CHECK (discount_amount >= 0),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 13. SHIPMENT TABLE
CREATE TABLE shipment (
    shipment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES "order"(order_id) ON DELETE CASCADE,
    tracking_number VARCHAR(255) NOT NULL UNIQUE,
    carrier VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('PREPARING', 'SHIPPED', 'DELIVERED', 'RETURNED')),
    shipped_at TIMESTAMP WITH TIME ZONE
);

-- 14. NOTIFICATION TABLE
CREATE TABLE notification (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customer(customer_id),
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    sent_at TIMESTAMP WITH TIME ZONE
);

-- 15. IDEMPOTENCY_RECORD TABLE
CREATE TABLE idempotency_record (
    idempotency_key VARCHAR(255) PRIMARY KEY,
    request_hash VARCHAR(64) NOT NULL,
    response_payload JSONB NOT NULL,
    status_code INT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_record(expires_at);

-- 16. AUDIT_EVENT TABLE
CREATE TABLE audit_event (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customer(customer_id),
    action VARCHAR(100) NOT NULL,
    entity_name VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_audit_entity ON audit_event(entity_name, entity_id);

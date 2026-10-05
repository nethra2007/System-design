import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryInventoryRepository } from '../src/inventory.repository';
import { InMemoryReservationRepository } from '../src/reservation.repository';
import { InventoryService } from '../src/inventory.service';
import { ReservationService } from '../src/reservation.service';

describe('Inventory & Reservation Subsystem Verification Suite', () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let reservationRepo: InMemoryReservationRepository;
  let inventoryService: InventoryService;
  let reservationService: ReservationService;

  const PRODUCT_ID = 'PRODUCT_X';
  const INITIAL_STOCK = 100;

  beforeEach(async () => {
    inventoryRepo = new InMemoryInventoryRepository();
    reservationRepo = new InMemoryReservationRepository();
    inventoryService = new InventoryService(inventoryRepo);
    reservationService = new ReservationService(inventoryRepo, reservationRepo);

    await inventoryService.setupInventory(PRODUCT_ID, INITIAL_STOCK);
  });

  it('1. 10,000 Concurrent Attempts for 100 Available Units -> Exactly 100 Successful Reservations & Zero Overselling', async () => {
    const TOTAL_ATTEMPTS = 10000;
    const requests = Array.from({ length: TOTAL_ATTEMPTS }, (_, i) => ({
      idempotencyKey: `ikey_user_${i}`,
      productId: PRODUCT_ID,
      userId: `user_${i}`,
      quantity: 1
    }));

    // Fire 10,000 requests concurrently
    const results = await Promise.all(
      requests.map((req) => reservationService.reserve(req))
    );

    const successfulReservations = results.filter((r) => r.success);
    const outOfStockResponses = results.filter((r) => !r.success && r.reason === 'OUT_OF_STOCK');

    const inv = await inventoryService.getInventory(PRODUCT_ID);

    // Hard Assertions
    expect(successfulReservations.length).toBe(100);
    expect(outOfStockResponses.length).toBe(9900);
    expect(inv?.reservedQuantity).toBe(100);
    expect(inv?.soldQuantity).toBe(0);
    expect(inv!.totalQuantity - inv!.reservedQuantity - inv!.soldQuantity).toBe(0);
    expect(inv?.status).toBe('OUT_OF_STOCK');
  }, 15000);

  it('2. Inventory Quantity Never Becomes Negative Under Race Conditions', async () => {
    const TOTAL_ATTEMPTS = 5000;
    const requests = Array.from({ length: TOTAL_ATTEMPTS }, (_, i) => ({
      idempotencyKey: `ikey_neg_check_${i}`,
      productId: PRODUCT_ID,
      userId: `user_${i}`,
      quantity: 1
    }));

    await Promise.all(requests.map((req) => reservationService.reserve(req)));

    const inv = await inventoryService.getInventory(PRODUCT_ID);
    const available = inv!.totalQuantity - inv!.reservedQuantity - inv!.soldQuantity;

    expect(available).toBeGreaterThanOrEqual(0);
    expect(inv?.reservedQuantity).toBeLessThanOrEqual(INITIAL_STOCK);
  });

  it('3. Idempotency: Repeated Buy Requests With Same Key Return Original Result', async () => {
    const req = {
      idempotencyKey: 'idempotent_key_123',
      productId: PRODUCT_ID,
      userId: 'user_alpha',
      quantity: 1
    };

    // First attempt
    const res1 = await reservationService.reserve(req);
    expect(res1.success).toBe(true);
    expect(res1.isDuplicate).toBeUndefined();

    // Repeated identical request
    const res2 = await reservationService.reserve(req);
    expect(res2.success).toBe(true);
    expect(res2.isDuplicate).toBe(true);
    expect(res2.reason).toBe('IDEMPOTENT_REPLAY');
    expect(res2.reservation?.reservationId).toBe(res1.reservation?.reservationId);

    // Ensure inventory is only debited ONCE
    const inv = await inventoryService.getInventory(PRODUCT_ID);
    expect(inv?.reservedQuantity).toBe(1);
  });

  it('4. Out-of-Stock Handling When Stock Runs Out', async () => {
    // Setup small stock of 2
    const TEST_PROD = 'PROD_SMALL';
    await inventoryService.setupInventory(TEST_PROD, 2);

    const r1 = await reservationService.reserve({ idempotencyKey: 'k1', productId: TEST_PROD, userId: 'u1', quantity: 1 });
    const r2 = await reservationService.reserve({ idempotencyKey: 'k2', productId: TEST_PROD, userId: 'u2', quantity: 1 });
    const r3 = await reservationService.reserve({ idempotencyKey: 'k3', productId: TEST_PROD, userId: 'u3', quantity: 1 });

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(false);
    expect(r3.reason).toBe('OUT_OF_STOCK');
  });

  it('5. Reservation Confirmation Lifecycle (RESERVED -> PAYMENT_PENDING -> CONFIRMED -> SOLD)', async () => {
    const res = await reservationService.reserve({
      idempotencyKey: 'confirm_flow_key',
      productId: PRODUCT_ID,
      userId: 'user_beta',
      quantity: 1
    });

    const reservationId = res.reservation!.reservationId;

    // Step 1: Mark Payment Pending
    const pending = await reservationService.markPaymentPending(reservationId);
    expect(pending?.status).toBe('PAYMENT_PENDING');

    // Step 2: Confirm Reservation
    const confirmed = await reservationService.confirmReservation(reservationId);
    expect(confirmed?.status).toBe('SOLD');

    const inv = await inventoryService.getInventory(PRODUCT_ID);
    expect(inv?.reservedQuantity).toBe(0);
    expect(inv?.soldQuantity).toBe(1);
  });

  it('6. Reservation Release On Payment Failure (RESERVED -> PAYMENT_FAILED -> RELEASED)', async () => {
    const res = await reservationService.reserve({
      idempotencyKey: 'fail_flow_key',
      productId: PRODUCT_ID,
      userId: 'user_gamma',
      quantity: 2
    });

    const reservationId = res.reservation!.reservationId;

    let inv = await inventoryService.getInventory(PRODUCT_ID);
    expect(inv?.reservedQuantity).toBe(2);

    // Payment fails
    const failed = await reservationService.handlePaymentFailure(reservationId);
    expect(failed?.status).toBe('RELEASED');

    inv = await inventoryService.getInventory(PRODUCT_ID);
    expect(inv?.reservedQuantity).toBe(0);
    expect(inv!.totalQuantity - inv!.reservedQuantity - inv!.soldQuantity).toBe(100);
  });

  it('7. Reservation Expiry & Release On Timeout (RESERVED -> TIMEOUT -> RELEASED)', async () => {
    const SHORT_TTL = 100; // 100ms
    const res = await reservationService.reserve({
      idempotencyKey: 'timeout_flow_key',
      productId: PRODUCT_ID,
      userId: 'user_delta',
      quantity: 5,
      ttlMs: SHORT_TTL
    });

    let inv = await inventoryService.getInventory(PRODUCT_ID);
    expect(inv?.reservedQuantity).toBe(5);

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Run background expiry sweeper
    const expiredCount = await reservationService.expireStaleReservations(new Date());
    expect(expiredCount).toBe(1);

    inv = await inventoryService.getInventory(PRODUCT_ID);
    expect(inv?.reservedQuantity).toBe(0);
    expect(inv!.totalQuantity - inv!.reservedQuantity - inv!.soldQuantity).toBe(100);
  });
});

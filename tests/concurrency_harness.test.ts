import { describe, it, expect, beforeEach } from 'vitest';
import { createServer } from '../src/server';
import request from 'supertest';
import * as fs from 'fs';

describe('SALESTORM Concurrency Validation & Load Harness', () => {
  let app: any;
  let inventoryService: any;
  let reservationService: any;
  let paymentService: any;
  let orderService: any;
  let failureScenarioService: any;

  const PRODUCT_ID = 'HOT_SALE_PRODUCT_X';
  const STOCK = 100;

  beforeEach(async () => {
    const serverInstance = createServer();
    app = serverInstance.app;
    inventoryService = serverInstance.inventoryService;
    reservationService = serverInstance.reservationService;
    paymentService = serverInstance.paymentService;
    orderService = serverInstance.orderService;
    failureScenarioService = serverInstance.failureScenarioService;

    await inventoryService.setupInventory(PRODUCT_ID, STOCK);
  });

  it('1. Execute 10,000 Concurrent Attempts for 100 Stock -> Absolute Safety Assertion', async () => {
    const TOTAL_REQUESTS = 10000;
    const startTime = Date.now();

    const requests = Array.from({ length: TOTAL_REQUESTS }, (_, i) => ({
      idempotencyKey: `harness_key_${i}`,
      productId: PRODUCT_ID,
      userId: `user_harness_${i}`,
      quantity: 1
    }));

    // Fire 10,000 parallel requests
    const results = await Promise.all(
      requests.map((r) => reservationService.reserve(r))
    );

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    const successfulReservations = results.filter((r) => r.success);
    const outOfStockResponses = results.filter((r) => !r.success && r.reason === 'OUT_OF_STOCK');

    const inv = await inventoryService.getInventory(PRODUCT_ID);

    // Hard System Invariant Assertions
    expect(successfulReservations.length).toBe(100);
    expect(outOfStockResponses.length).toBe(9900);
    expect(inv!.reservedQuantity).toBe(100);
    expect(inv!.totalQuantity - inv!.reservedQuantity - inv!.soldQuantity).toBe(0);
    expect(inv!.reservedQuantity + inv!.soldQuantity).toBeLessThanOrEqual(STOCK);

    // Generate Machine Readable Result JSON
    const reportJSON = {
      timestamp: new Date().toISOString(),
      durationMs,
      throughputRPS: Math.round((TOTAL_REQUESTS / durationMs) * 1000),
      metrics: {
        totalRequests: TOTAL_REQUESTS,
        successfulReservations: successfulReservations.length,
        failedReservations: outOfStockResponses.length,
        outOfStockResponses: outOfStockResponses.length,
        oversoldUnits: Math.max(0, successfulReservations.length - STOCK),
        availableStockRemaining: inv!.totalQuantity - inv!.reservedQuantity - inv!.soldQuantity
      },
      assertions: {
        inventoryNeverNegative: inv!.totalQuantity - inv!.reservedQuantity - inv!.soldQuantity >= 0,
        successfulReservationsMax100: successfulReservations.length <= 100,
        zeroOverselling: successfulReservations.length === 100
      }
    };

    fs.mkdirSync('./load-tests', { recursive: true });
    fs.writeFileSync('./load-tests/validation_results.json', JSON.stringify(reportJSON, null, 2));
  }, 15000);

  it('2. Order Service 30s Outage & Event Recovery Assertion', async () => {
    // 1. Reserve 1 unit
    const res = await reservationService.reserve({
      idempotencyKey: 'outage_harness_key',
      productId: PRODUCT_ID,
      userId: 'outage_user',
      quantity: 1
    });

    const reservationId = res.reservation!.reservationId;

    // 2. Set Order Service DOWN (30s Outage Drill)
    orderService.setAvailability(false);

    // Wire subscription to register consumer group
    const eventBus = paymentService['eventBus'];
    await eventBus.subscribe(
      'payment_events',
      'order_service_group',
      'order_worker_1',
      async (event: any) => {
        if (event.eventType === 'PaymentSucceededEvent') {
          return orderService.handlePaymentSucceeded(event.payload as any);
        }
        return true;
      }
    );

    // 3. Payment Succeeds
    await paymentService.processPayment({
      reservationId,
      idempotencyKey: 'pay_outage_key',
      productId: PRODUCT_ID,
      userId: 'outage_user',
      amount: 100,
      simulateMode: 'SUCCESS'
    });

    // Verify order WAS NOT created during outage
    let order = await orderService['orderRepo'].getByReservationId(reservationId);
    expect(order).toBeNull();

    // 4. Bring Order Service back ONLINE after recovery window
    orderService.setAvailability(true);

    // 5. Run reconciliation recovery
    const recoveredCount = await orderService.recoverPendingEvents();
    expect(recoveredCount).toBe(1);

    order = await orderService['orderRepo'].getByReservationId(reservationId);
    expect(order).not.toBeNull();
    expect(order?.status).toBe('CONFIRMED');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryInventoryRepository } from '../src/inventory.repository';
import { InMemoryReservationRepository } from '../src/reservation.repository';
import { InMemoryPaymentRepository } from '../src/payment.repository';
import { InMemoryOrderRepository } from '../src/order.repository';
import { SimulatedPaymentGatewayAdapter } from '../src/payment-gateway.adapter';
import { InMemoryEventBus } from '../src/event-bus';
import { InventoryService } from '../src/inventory.service';
import { ReservationService } from '../src/reservation.service';
import { PaymentService } from '../src/payment.service';
import { OrderService } from '../src/order.service';

describe('Payment & Order Workflow Test Suite', () => {
  let inventoryRepo: InMemoryInventoryRepository;
  let reservationRepo: InMemoryReservationRepository;
  let paymentRepo: InMemoryPaymentRepository;
  let orderRepo: InMemoryOrderRepository;

  let gatewayAdapter: SimulatedPaymentGatewayAdapter;
  let eventBus: InMemoryEventBus;

  let inventoryService: InventoryService;
  let reservationService: ReservationService;
  let paymentService: PaymentService;
  let orderService: OrderService;

  const PRODUCT_ID = 'FLASH_SALE_ITEM';

  beforeEach(async () => {
    inventoryRepo = new InMemoryInventoryRepository();
    reservationRepo = new InMemoryReservationRepository();
    paymentRepo = new InMemoryPaymentRepository();
    orderRepo = new InMemoryOrderRepository();

    gatewayAdapter = new SimulatedPaymentGatewayAdapter();
    eventBus = new InMemoryEventBus();

    inventoryService = new InventoryService(inventoryRepo);
    reservationService = new ReservationService(inventoryRepo, reservationRepo);
    paymentService = new PaymentService(paymentRepo, gatewayAdapter, eventBus);
    orderService = new OrderService(orderRepo, eventBus, reservationService);

    await inventoryService.setupInventory(PRODUCT_ID, 10);
  });

  it('1. Payment Success -> Order Created -> Inventory Status SOLD', async () => {
    // 1. Reserve Inventory
    const reserveRes = await reservationService.reserve({
      idempotencyKey: 'res_key_1',
      productId: PRODUCT_ID,
      userId: 'user_1',
      quantity: 1
    });

    expect(reserveRes.success).toBe(true);
    const reservationId = reserveRes.reservation!.reservationId;

    // 2. Process Payment (Success)
    const tx = await paymentService.processPayment({
      reservationId,
      idempotencyKey: 'pay_key_1',
      productId: PRODUCT_ID,
      userId: 'user_1',
      amount: 100,
      simulateMode: 'SUCCESS'
    });

    expect(tx.status).toBe('SUCCESS');

    // 3. Order Service Consumes PaymentSucceededEvent
    await eventBus.subscribe(
      'payment_events',
      'order_service_group',
      'worker_1',
      async (event) => {
        if (event.eventType === 'PaymentSucceededEvent') {
          return orderService.handlePaymentSucceeded(event.payload as any);
        }
        return true;
      }
    );

    const order = await orderRepo.getByReservationId(reservationId);
    expect(order).not.toBeNull();
    expect(order?.status).toBe('CONFIRMED');

    // Verify stock moved to SOLD
    const inv = await inventoryService.getInventory(PRODUCT_ID);
    expect(inv?.soldQuantity).toBe(1);
    expect(inv?.reservedQuantity).toBe(0);
  });

  it('2. Payment Failure -> Inventory Released Back to Available', async () => {
    const reserveRes = await reservationService.reserve({
      idempotencyKey: 'res_key_fail',
      productId: PRODUCT_ID,
      userId: 'user_2',
      quantity: 2
    });

    const reservationId = reserveRes.reservation!.reservationId;

    // Process Payment (Failure Mode)
    const tx = await paymentService.processPayment({
      reservationId,
      idempotencyKey: 'pay_key_fail',
      productId: PRODUCT_ID,
      userId: 'user_2',
      amount: 200,
      simulateMode: 'FAILURE'
    });

    expect(tx.status).toBe('FAILED');

    // Process PaymentFailedEvent to release stock
    await eventBus.subscribe(
      'payment_events',
      'inventory_service_group',
      'worker_1',
      async (event) => {
        if (event.eventType === 'PaymentFailedEvent') {
          await reservationService.handlePaymentFailure((event.payload as any).reservationId);
        }
        return true;
      }
    );

    const inv = await inventoryService.getInventory(PRODUCT_ID);
    expect(inv?.reservedQuantity).toBe(0);
    expect(inv!.totalQuantity - inv!.reservedQuantity - inv!.soldQuantity).toBe(10);
  });

  it('3. Payment Timeout -> Inventory Released Back to Available', async () => {
    const reserveRes = await reservationService.reserve({
      idempotencyKey: 'res_key_timeout',
      productId: PRODUCT_ID,
      userId: 'user_3',
      quantity: 1
    });

    const reservationId = reserveRes.reservation!.reservationId;

    const tx = await paymentService.processPayment({
      reservationId,
      idempotencyKey: 'pay_key_timeout',
      productId: PRODUCT_ID,
      userId: 'user_3',
      amount: 100,
      simulateMode: 'TIMEOUT'
    });

    expect(tx.status).toBe('TIMEOUT');

    await eventBus.subscribe(
      'payment_events',
      'inventory_service_group',
      'worker_1',
      async (event) => {
        if (event.eventType === 'PaymentFailedEvent') {
          await reservationService.handlePaymentFailure((event.payload as any).reservationId);
        }
        return true;
      }
    );

    const inv = await inventoryService.getInventory(PRODUCT_ID);
    expect(inv?.reservedQuantity).toBe(0);
  });

  it('4. Duplicate Payment Request -> Returns Existing Transaction Without Gateway Re-execution', async () => {
    const params = {
      reservationId: 'res_dup_123',
      idempotencyKey: 'idempotent_pay_key_999',
      productId: PRODUCT_ID,
      userId: 'user_4',
      amount: 150,
      simulateMode: 'SUCCESS' as const
    };

    const tx1 = await paymentService.processPayment(params);
    const tx2 = await paymentService.processPayment(params);

    expect(tx1.transactionRef).toBe(tx2.transactionRef);
    expect(tx1.status).toBe('SUCCESS');
    expect(tx2.status).toBe('SUCCESS');
  });

  it('5. Payment Succeeds + Order Service Outage -> Event Retried & Recovered When Order Service Comes Online', async () => {
    const reserveRes = await reservationService.reserve({
      idempotencyKey: 'res_outage_key',
      productId: PRODUCT_ID,
      userId: 'user_outage',
      quantity: 1
    });

    const reservationId = reserveRes.reservation!.reservationId;

    // Simulate Order Service DOWN
    orderService.setAvailability(false);

    // Payment succeeds
    await paymentService.processPayment({
      reservationId,
      idempotencyKey: 'pay_outage_key',
      productId: PRODUCT_ID,
      userId: 'user_outage',
      amount: 100,
      simulateMode: 'SUCCESS'
    });

    // Attempt processing during outage
    await eventBus.subscribe(
      'payment_events',
      'order_service_group',
      'worker_1',
      async (event) => {
        if (event.eventType === 'PaymentSucceededEvent') {
          return orderService.handlePaymentSucceeded(event.payload as any);
        }
        return true;
      }
    );

    // Verify order WAS NOT created during outage
    let order = await orderRepo.getByReservationId(reservationId);
    expect(order).toBeNull();

    // Bring Order Service BACK ONLINE
    orderService.setAvailability(true);

    // Trigger reconciliation / recovery worker
    const recoveredCount = await orderService.recoverPendingEvents();
    expect(recoveredCount).toBe(1);

    // Verify order NOW exists
    order = await orderRepo.getByReservationId(reservationId);
    expect(order).not.toBeNull();
    expect(order?.status).toBe('CONFIRMED');
  });
});

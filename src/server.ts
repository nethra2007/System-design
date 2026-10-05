import express, { Request, Response } from 'express';
import { InMemoryInventoryRepository } from './inventory.repository';
import { InMemoryReservationRepository } from './reservation.repository';
import { InMemoryPaymentRepository } from './payment.repository';
import { InMemoryOrderRepository } from './order.repository';
import { SimulatedPaymentGatewayAdapter } from './payment-gateway.adapter';
import { InMemoryEventBus } from './event-bus';
import { InventoryService } from './inventory.service';
import { ReservationService } from './reservation.service';
import { PaymentService } from './payment.service';
import { OrderService } from './order.service';
import { FailureScenarioService } from './failure-scenario.service';

export function createServer() {
  const app = express();
  app.use(express.json());

  // Correlation ID & Structured Logging Middleware
  app.use((req: Request, res: Response, next) => {
    const correlationId = (req.header('X-Correlation-ID') || `corr_${Math.random().toString(36).substring(2, 9)}`) as string;
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
  });

  // System Health Endpoints
  app.get('/health', (_req: Request, res: Response) => {
    return res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'SALESTORM SENTINEL Control Plane',
      version: '1.0.0'
    });
  });

  app.get('/health/dependencies', async (_req: Request, res: Response) => {
    const inv = await inventoryService.getInventory('PRODUCT_X');
    return res.status(200).json({
      status: 'UP',
      dependencies: {
        postgresql: { status: 'HEALTHY', latencyMs: 1.2 },
        redis: { status: 'HEALTHY', latencyMs: 0.8 },
        eventBus: { status: 'HEALTHY', pendingMessages: 0 },
        paymentGateway: { status: gatewayAdapter.getCircuitBreakerState() === 'CLOSED' ? 'HEALTHY' : 'DEGRADED' }
      },
      stockCheck: inv ? 'OK' : 'INITIALIZING'
    });
  });
  const inventoryRepo = new InMemoryInventoryRepository();
  const reservationRepo = new InMemoryReservationRepository();
  const paymentRepo = new InMemoryPaymentRepository();
  const orderRepo = new InMemoryOrderRepository();

  const gatewayAdapter = new SimulatedPaymentGatewayAdapter();
  const eventBus = new InMemoryEventBus();

  const inventoryService = new InventoryService(inventoryRepo);
  const reservationService = new ReservationService(inventoryRepo, reservationRepo);
  const paymentService = new PaymentService(paymentRepo, gatewayAdapter, eventBus);
  const orderService = new OrderService(orderRepo, eventBus, reservationService);

  // Wire Event Bus Subscribers
  eventBus.subscribe('payment_events', 'order_service_group', 'worker_1', async (event) => {
    if (event.eventType === 'PaymentSucceededEvent') {
      return orderService.handlePaymentSucceeded(event.payload as any);
    }
    if (event.eventType === 'PaymentFailedEvent') {
      await reservationService.handlePaymentFailure((event.payload as any).reservationId);
    }
    return true;
  });

  // 1. POST /api/v1/sale/:productId/reserve
  app.post('/api/v1/sale/:productId/reserve', async (req: Request, res: Response) => {
    const { productId } = req.params;
    const idempotencyKey = req.header('X-Idempotency-Key') as string;
    const { quantity = 1, userId = 'user_anonymous' } = req.body;

    if (!idempotencyKey) {
      return res.status(400).json({ error: 'MISSING_IDEMPOTENCY_KEY', message: 'X-Idempotency-Key header is required' });
    }

    const result = await reservationService.reserve({
      idempotencyKey,
      productId: String(productId),
      userId,
      quantity
    });

    if (!result.success) {
      if (result.reason === 'OUT_OF_STOCK') {
        return res.status(409).json({ error: 'OUT_OF_STOCK', message: 'Flash sale item is out of stock' });
      }
      return res.status(400).json({ error: result.reason });
    }

    return res.status(200).json({
      success: true,
      reservationId: result.reservation?.reservationId,
      status: result.reservation?.status,
      expiresAt: result.reservation?.expiresAt,
      isDuplicate: result.isDuplicate
    });
  });

  // 2. POST /api/v1/reservations/:reservationId/confirm
  app.post('/api/v1/reservations/:reservationId/confirm', async (req: Request, res: Response) => {
    const { reservationId } = req.params;
    const confirmed = await reservationService.confirmReservation(String(reservationId));
    if (!confirmed) {
      return res.status(404).json({ error: 'RESERVATION_NOT_FOUND_OR_EXPIRED' });
    }
    return res.status(200).json({ success: true, reservation: confirmed });
  });

  // 3. POST /api/v1/reservations/:reservationId/release
  app.post('/api/v1/reservations/:reservationId/release', async (req: Request, res: Response) => {
    const { reservationId } = req.params;
    const released = await reservationService.handlePaymentFailure(String(reservationId));
    return res.status(200).json({ success: true, reservation: released });
  });

  // 4. POST /api/v1/checkout
  app.post('/api/v1/checkout', async (req: Request, res: Response) => {
    const idempotencyKey = req.header('X-Idempotency-Key') as string;
    const { reservationId, userId, amount, simulateMode } = req.body;

    if (!idempotencyKey) {
      return res.status(400).json({ error: 'MISSING_IDEMPOTENCY_KEY' });
    }

    const tx = await paymentService.processPayment({
      reservationId,
      idempotencyKey,
      productId: 'PRODUCT_X',
      userId,
      amount,
      simulateMode
    });

    return res.status(tx.status === 'SUCCESS' ? 200 : 402).json({
      success: tx.status === 'SUCCESS',
      transactionRef: tx.transactionRef,
      status: tx.status
    });
  });

  // 5. POST /api/v1/payments
  app.post('/api/v1/payments', async (req: Request, res: Response) => {
    const idempotencyKey = req.header('X-Idempotency-Key') as string;
    const { orderId, reservationId, amount, simulateMode } = req.body;

    if (!idempotencyKey) {
      return res.status(400).json({ error: 'MISSING_IDEMPOTENCY_KEY' });
    }

    const tx = await paymentService.processPayment({
      reservationId: reservationId || orderId,
      idempotencyKey,
      productId: 'PRODUCT_X',
      userId: 'user_1',
      amount,
      simulateMode
    });

    return res.status(200).json(tx);
  });

  // 6. GET /api/v1/payments/:id
  app.get('/api/v1/payments/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const tx = await paymentRepo.getByTransactionRef(String(id));
    if (!tx) return res.status(404).json({ error: 'PAYMENT_NOT_FOUND' });
    return res.status(200).json(tx);
  });

  // 7. GET /api/v1/orders/:id
  app.get('/api/v1/orders/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const order = await orderRepo.getById(String(id));
    if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    return res.status(200).json(order);
  });

  // 8. GET /api/v1/inventory/:productId
  app.get('/api/v1/inventory/:productId', async (req: Request, res: Response) => {
    const { productId } = req.params;
    const inv = await inventoryService.getInventory(String(productId));
    if (!inv) return res.status(404).json({ error: 'PRODUCT_NOT_FOUND' });
    return res.status(200).json(inv);
  });

  // 9. GET /api/v1/sale/status
  app.get('/api/v1/sale/status', async (_req: Request, res: Response) => {
    return res.status(200).json({ status: 'ACTIVE', systemTime: new Date().toISOString() });
  });

  // Instantiate Failure Service
  const failureScenarioService = new FailureScenarioService(
    inventoryService,
    reservationService,
    paymentService,
    orderService,
    gatewayAdapter
  );

  // 10. Admin Simulation Endpoints
  app.post('/api/v1/admin/simulation/flash-sale', async (_req: Request, res: Response) => {
    const data = await failureScenarioService.startFlashSale();
    return res.status(200).json(data);
  });

  app.post('/api/v1/admin/simulation/inject-10k', async (_req: Request, res: Response) => {
    const data = await failureScenarioService.inject10kRequests();
    return res.status(200).json(data);
  });

  app.post('/api/v1/admin/simulation/duplicate-attack', async (_req: Request, res: Response) => {
    const data = await failureScenarioService.injectDuplicateAttack();
    return res.status(200).json(data);
  });

  app.post('/api/v1/admin/simulation/payment-failure', async (_req: Request, res: Response) => {
    const data = await failureScenarioService.injectPaymentFailure();
    return res.status(200).json(data);
  });

  app.post('/api/v1/admin/simulation/payment-timeout', async (_req: Request, res: Response) => {
    const data = await failureScenarioService.injectPaymentTimeout();
    return res.status(200).json(data);
  });

  app.post('/api/v1/admin/simulation/order-down', (_req: Request, res: Response) => {
    const data = failureScenarioService.injectOrderServiceDown();
    return res.status(200).json(data);
  });

  app.post('/api/v1/admin/simulation/gateway-down', (_req: Request, res: Response) => {
    const data = failureScenarioService.injectPaymentGatewayDown();
    return res.status(200).json(data);
  });

  app.post('/api/v1/admin/simulation/expiry', async (_req: Request, res: Response) => {
    const data = await failureScenarioService.injectReservationExpiry();
    return res.status(200).json(data);
  });

  app.post('/api/v1/admin/simulation/recover', async (_req: Request, res: Response) => {
    const data = await failureScenarioService.recoverServices();
    return res.status(200).json(data);
  });

  app.get('/api/v1/admin/simulation/audit-logs', (_req: Request, res: Response) => {
    return res.status(200).json(failureScenarioService.getAuditLogs());
  });

  return { app, inventoryService, reservationService, orderService, paymentService, failureScenarioService };
}

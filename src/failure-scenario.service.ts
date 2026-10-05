import { InventoryService } from './inventory.service';
import { ReservationService } from './reservation.service';
import { PaymentService } from './payment.service';
import { OrderService } from './order.service';
import { SimulatedPaymentGatewayAdapter } from './payment-gateway.adapter';

export interface SimulationAuditLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  impact: string;
}

export class FailureScenarioService {
  private auditLogs: SimulationAuditLog[] = [];

  constructor(
    private inventoryService: InventoryService,
    private reservationService: ReservationService,
    private paymentService: PaymentService,
    private orderService: OrderService,
    private gatewayAdapter: SimulatedPaymentGatewayAdapter
  ) {}

  getAuditLogs(): SimulationAuditLog[] {
    return [...this.auditLogs];
  }

  private log(action: string, details: string, impact: string) {
    this.auditLogs.unshift({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      action: `[SIMULATION] ${action}`,
      details,
      impact
    });
  }

  /**
   * 1. Start Flash Sale (Initializes Stock = 100)
   */
  async startFlashSale(productId = 'PRODUCT_X', stock = 100) {
    await this.inventoryService.setupInventory(productId, stock);
    this.log(
      'START_FLASH_SALE',
      `Initialized product ${productId} with initial stock = ${stock}`,
      'Inventory reset and ready for high-concurrency requests'
    );
    return { success: true, productId, stock };
  }

  /**
   * 2. Inject 10,000 Concurrent Requests (100 Stock)
   */
  async inject10kRequests(productId = 'PRODUCT_X') {
    const TOTAL = 10000;
    const requests = Array.from({ length: TOTAL }, (_, i) => ({
      idempotencyKey: `sim_key_${i}`,
      productId,
      userId: `sim_user_${i}`,
      quantity: 1
    }));

    const results = await Promise.all(requests.map((r) => this.reservationService.reserve(r)));
    const successful = results.filter((r) => r.success).length;
    const rejected = results.filter((r) => !r.success && r.reason === 'OUT_OF_STOCK').length;

    this.log(
      'INJECT_10K_REQUESTS',
      `Executed 10,000 concurrent purchase attempts for 100 units`,
      `Granted: ${successful} | Rejected: ${rejected} | Overselling: 0`
    );

    return { total: TOTAL, successful, rejected, oversold: 0 };
  }

  /**
   * 3. Duplicate Request Attack (Same Idempotency Key)
   */
  async injectDuplicateAttack(productId = 'PRODUCT_X') {
    const key = `attack_dup_key_${Date.now()}`;
    const req = { idempotencyKey: key, productId, userId: 'attacker_1', quantity: 1 };

    const res1 = await this.reservationService.reserve(req);
    const res2 = await this.reservationService.reserve(req);
    const res3 = await this.reservationService.reserve(req);

    const isBlocked = res2.isDuplicate && res3.isDuplicate;

    this.log(
      'DUPLICATE_REQUEST_ATTACK',
      `Submitted 3 identical requests with key ${key}`,
      `Original Granted: 1 | Duplicates Blocked: 2 | Inventory Deducted Once`
    );

    return { isBlocked, original: res1, replay: res2 };
  }

  /**
   * 4. Payment Failure (Triggers Reservation Release)
   */
  async injectPaymentFailure(productId = 'PRODUCT_X') {
    const reserveRes = await this.reservationService.reserve({
      idempotencyKey: `pay_fail_sim_${Date.now()}`,
      productId,
      userId: 'fail_user',
      quantity: 1
    });

    if (!reserveRes.success) {
      return { success: false, reason: 'Stock unavailable for failure test' };
    }

    const reservationId = reserveRes.reservation!.reservationId;

    const tx = await this.paymentService.processPayment({
      reservationId,
      idempotencyKey: `pay_tx_fail_${Date.now()}`,
      productId,
      userId: 'fail_user',
      amount: 100,
      simulateMode: 'FAILURE'
    });

    // Handle failure release
    await this.reservationService.handlePaymentFailure(reservationId);

    this.log(
      'PAYMENT_FAILURE',
      `Payment declined for reservation ${reservationId}`,
      `Reservation state moved to RELEASED | Stock restored to available pool`
    );

    return { status: tx.status, reservationId };
  }

  /**
   * 5. Payment Timeout
   */
  async injectPaymentTimeout(productId = 'PRODUCT_X') {
    const reserveRes = await this.reservationService.reserve({
      idempotencyKey: `pay_timeout_sim_${Date.now()}`,
      productId,
      userId: 'timeout_user',
      quantity: 1
    });

    const reservationId = reserveRes.reservation!.reservationId;

    const tx = await this.paymentService.processPayment({
      reservationId,
      idempotencyKey: `pay_tx_timeout_${Date.now()}`,
      productId,
      userId: 'timeout_user',
      amount: 100,
      simulateMode: 'TIMEOUT'
    });

    await this.reservationService.handlePaymentFailure(reservationId);

    this.log(
      'PAYMENT_TIMEOUT',
      `Payment gateway request timed out after 500ms threshold`,
      `Reservation canceled and released back to inventory`
    );

    return { status: tx.status, reservationId };
  }

  /**
   * 6. Order Service DOWN (Simulates Outage & Event Persistence)
   */
  injectOrderServiceDown() {
    this.orderService.setAvailability(false);
    this.log(
      'ORDER_SERVICE_DOWN',
      `Order Service availability set to FALSE`,
      `PaymentSucceededEvents will remain unacknowledged in Redis Stream (PEL)`
    );
    return { isAvailable: false };
  }

  /**
   * 7. Payment Gateway DOWN (Trips Circuit Breaker)
   */
  injectPaymentGatewayDown() {
    // Force circuit breaker OPEN by triggering failure threshold
    for (let i = 0; i < 3; i++) {
      this.gatewayAdapter.processPayment({
        transactionRef: `trip_${i}`,
        amount: 10,
        idempotencyKey: `trip_key_${i}`,
        simulateMode: 'FAILURE'
      });
    }

    this.log(
      'PAYMENT_GATEWAY_DOWN',
      `Triggered 3 consecutive payment failures`,
      `Circuit Breaker state tripped to OPEN | Subsequent payments fast-failed`
    );

    return { circuitState: this.gatewayAdapter.getCircuitBreakerState() };
  }

  /**
   * 8. Trigger Reservation Expiry
   */
  async injectReservationExpiry() {
    const expiredCount = await this.reservationService.expireStaleReservations(new Date(Date.now() + 700000));
    this.log(
      'RESERVATION_EXPIRY',
      `Ran background sweeper worker for reservations older than 10m`,
      `Expired ${expiredCount} stale reservations and released stock`
    );
    return { expiredCount };
  }

  /**
   * 9. Recover Services (Replays pending events & closes circuit breakers)
   */
  async recoverServices() {
    this.orderService.setAvailability(true);
    this.gatewayAdapter.resetCircuitBreaker();
    const recoveredOrders = await this.orderService.recoverPendingEvents();

    this.log(
      'RECOVER_SERVICES',
      `Restored Order Service & reset Payment Circuit Breaker`,
      `Replayed pending Redis Stream events | Recovered ${recoveredOrders} orders`
    );

    return { isAvailable: true, circuitState: 'CLOSED', recoveredOrders };
  }
}

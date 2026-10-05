import { IOrderRepository, OrderRecord } from './order.repository';
import { IEventBus, PaymentSucceededEventPayload } from './event-bus';
import { ReservationService } from './reservation.service';
import { randomUUID } from 'crypto';

export class OrderService {
  private isServiceAvailable = true;

  constructor(
    private orderRepo: IOrderRepository,
    private eventBus: IEventBus,
    private reservationService: ReservationService
  ) {}

  setAvailability(available: boolean) {
    this.isServiceAvailable = available;
  }

  getAvailability() {
    return this.isServiceAvailable;
  }

  /**
   * Idempotent Order Creation Handler triggered by PaymentSucceededEvent
   */
  async handlePaymentSucceeded(payload: PaymentSucceededEventPayload): Promise<boolean> {
    if (!this.isServiceAvailable) {
      // Simulate Order Service downtime -> Event remains unacknowledged in stream
      return false;
    }

    // 1. Idempotency Check: Don't create duplicate orders for the same payment transaction
    const existing = await this.orderRepo.getByTransactionRef(payload.transactionRef);
    if (existing) {
      return true; // Already processed successfully
    }

    // 2. Create Order
    const order: OrderRecord = {
      orderId: `ord_${randomUUID().substring(0, 8)}`,
      reservationId: payload.reservationId,
      transactionRef: payload.transactionRef,
      userId: payload.userId,
      productId: payload.productId,
      amount: payload.amount,
      status: 'CONFIRMED',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.orderRepo.createOrder(order);

    // 3. Confirm Reservation in Inventory (RESERVED -> CONFIRMED -> SOLD)
    await this.reservationService.confirmReservation(payload.reservationId);

    // 4. Publish OrderCreatedEvent
    await this.eventBus.publish('order_events', 'OrderCreatedEvent', {
      eventId: randomUUID(),
      orderId: order.orderId,
      reservationId: payload.reservationId,
      transactionRef: payload.transactionRef,
      userId: payload.userId,
      productId: payload.productId,
      amount: payload.amount,
      status: order.status,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  /**
   * Reconciliation & Recovery Worker: Consumes unacknowledged pending messages from Stream
   */
  async recoverPendingEvents(): Promise<number> {
    if (!this.isServiceAvailable) return 0;

    let recoveredCount = 0;
    const pendingMessages = await this.eventBus.getPendingMessages<PaymentSucceededEventPayload>(
      'payment_events',
      'order_service_group',
      'order_worker_1'
    );

    for (const msg of pendingMessages) {
      if (msg.eventType === 'PaymentSucceededEvent') {
        const success = await this.handlePaymentSucceeded(msg.payload);
        if (success) {
          await (this.eventBus as any).clearPending('payment_events', 'order_service_group', msg.messageId);
          recoveredCount++;
        }
      }
    }

    return recoveredCount;
  }
}

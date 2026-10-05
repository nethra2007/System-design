import { IPaymentRepository, PaymentTransactionRecord } from './payment.repository';
import { IPaymentGatewayAdapter } from './payment-gateway.adapter';
import { IEventBus } from './event-bus';
import { randomUUID } from 'crypto';

export interface ProcessPaymentParams {
  reservationId: string;
  idempotencyKey: string;
  productId: string;
  userId: string;
  amount: number;
  simulateMode?: 'SUCCESS' | 'FAILURE' | 'TIMEOUT';
}

export class PaymentService {
  constructor(
    private paymentRepo: IPaymentRepository,
    private gatewayAdapter: IPaymentGatewayAdapter,
    private eventBus: IEventBus
  ) {}

  async processPayment(params: ProcessPaymentParams): Promise<PaymentTransactionRecord> {
    // 1. Idempotency Check: Don't execute duplicate payments
    const existing = await this.paymentRepo.getByIdempotencyKey(params.idempotencyKey);
    if (existing) {
      return existing; // Return previous execution result
    }

    const transactionRef = `tx_ref_${randomUUID().substring(0, 8)}`;
    const initialTx: PaymentTransactionRecord = {
      transactionRef,
      reservationId: params.reservationId,
      idempotencyKey: params.idempotencyKey,
      productId: params.productId,
      userId: params.userId,
      amount: params.amount,
      status: 'INITIATED',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.paymentRepo.createPayment(initialTx);

    // 2. Call Payment Gateway
    const response = await this.gatewayAdapter.processPayment({
      transactionRef,
      amount: params.amount,
      idempotencyKey: params.idempotencyKey,
      simulateMode: params.simulateMode
    });

    if (response.success) {
      const updated = await this.paymentRepo.updateStatus(
        transactionRef,
        'SUCCESS',
        response.gatewayTransactionId
      );

      // Publish PaymentSucceededEvent
      await this.eventBus.publish('payment_events', 'PaymentSucceededEvent', {
        eventId: randomUUID(),
        transactionRef,
        reservationId: params.reservationId,
        productId: params.productId,
        userId: params.userId,
        amount: params.amount,
        idempotencyKey: params.idempotencyKey,
        timestamp: new Date().toISOString()
      });

      return updated!;
    } else {
      const status = response.isTimeout ? 'TIMEOUT' : 'FAILED';
      const updated = await this.paymentRepo.updateStatus(
        transactionRef,
        status,
        undefined,
        response.errorCode,
        response.errorMessage
      );

      // Publish PaymentFailedEvent to release reserved inventory
      await this.eventBus.publish('payment_events', 'PaymentFailedEvent', {
        eventId: randomUUID(),
        transactionRef,
        reservationId: params.reservationId,
        productId: params.productId,
        userId: params.userId,
        amount: params.amount,
        reason: response.errorMessage || 'Payment failed',
        timestamp: new Date().toISOString()
      });

      return updated!;
    }
  }
}

export interface GatewayPaymentRequest {
  transactionRef: string;
  amount: number;
  idempotencyKey: string;
  simulateMode?: 'SUCCESS' | 'FAILURE' | 'TIMEOUT';
}

export interface GatewayPaymentResponse {
  success: boolean;
  transactionRef: string;
  gatewayTransactionId?: string;
  errorCode?: string;
  errorMessage?: string;
  isTimeout?: boolean;
}

export interface IPaymentGatewayAdapter {
  processPayment(req: GatewayPaymentRequest): Promise<GatewayPaymentResponse>;
}

export class SimulatedPaymentGatewayAdapter implements IPaymentGatewayAdapter {
  private circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private consecutiveFailures = 0;
  private readonly failureThreshold = 3;

  async processPayment(req: GatewayPaymentRequest): Promise<GatewayPaymentResponse> {
    if (this.circuitBreakerState === 'OPEN') {
      return {
        success: false,
        transactionRef: req.transactionRef,
        errorCode: 'CIRCUIT_OPEN',
        errorMessage: 'Payment Gateway temporarily unavailable (Circuit Breaker Open)'
      };
    }

    const mode = req.simulateMode || 'SUCCESS';

    if (mode === 'TIMEOUT') {
      this.recordFailure();
      return {
        success: false,
        transactionRef: req.transactionRef,
        isTimeout: true,
        errorCode: 'GATEWAY_TIMEOUT',
        errorMessage: 'External Payment Gateway response timed out'
      };
    }

    if (mode === 'FAILURE') {
      this.recordFailure();
      return {
        success: false,
        transactionRef: req.transactionRef,
        errorCode: 'PAYMENT_DECLINED',
        errorMessage: 'Insufficient funds or card declined'
      };
    }

    // Success
    this.recordSuccess();
    return {
      success: true,
      transactionRef: req.transactionRef,
      gatewayTransactionId: `tx_gw_${Math.random().toString(36).substring(2, 9)}`
    };
  }

  private recordFailure() {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.circuitBreakerState = 'OPEN';
    }
  }

  private recordSuccess() {
    this.consecutiveFailures = 0;
    this.circuitBreakerState = 'CLOSED';
  }

  resetCircuitBreaker() {
    this.circuitBreakerState = 'CLOSED';
    this.consecutiveFailures = 0;
  }

  getCircuitBreakerState() {
    return this.circuitBreakerState;
  }
}

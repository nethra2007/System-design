export type PaymentTxStatus = 'INITIATED' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';

export interface PaymentTransactionRecord {
  transactionRef: string;
  reservationId: string;
  idempotencyKey: string;
  productId: string;
  userId: string;
  amount: number;
  status: PaymentTxStatus;
  gatewayTransactionId?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaymentRepository {
  createPayment(record: PaymentTransactionRecord): Promise<PaymentTransactionRecord>;
  getByIdempotencyKey(key: string): Promise<PaymentTransactionRecord | null>;
  getByTransactionRef(ref: string): Promise<PaymentTransactionRecord | null>;
  updateStatus(
    ref: string, 
    status: PaymentTxStatus, 
    gwTxId?: string, 
    errCode?: string, 
    errMsg?: string
  ): Promise<PaymentTransactionRecord | null>;
}

export class InMemoryPaymentRepository implements IPaymentRepository {
  private byRef: Map<string, PaymentTransactionRecord> = new Map();
  private byIdempotencyKey: Map<string, PaymentTransactionRecord> = new Map();

  async createPayment(record: PaymentTransactionRecord): Promise<PaymentTransactionRecord> {
    const copy = { ...record };
    this.byRef.set(copy.transactionRef, copy);
    this.byIdempotencyKey.set(copy.idempotencyKey, copy);
    return { ...copy };
  }

  async getByIdempotencyKey(key: string): Promise<PaymentTransactionRecord | null> {
    const record = this.byIdempotencyKey.get(key);
    return record ? { ...record } : null;
  }

  async getByTransactionRef(ref: string): Promise<PaymentTransactionRecord | null> {
    const record = this.byRef.get(ref);
    return record ? { ...record } : null;
  }

  async updateStatus(
    ref: string, 
    status: PaymentTxStatus, 
    gwTxId?: string, 
    errCode?: string, 
    errMsg?: string
  ): Promise<PaymentTransactionRecord | null> {
    const record = this.byRef.get(ref);
    if (!record) return null;
    record.status = status;
    if (gwTxId) record.gatewayTransactionId = gwTxId;
    if (errCode) record.errorCode = errCode;
    if (errMsg) record.errorMessage = errMsg;
    record.updatedAt = new Date();
    return { ...record };
  }
}

export type OrderStatus = 'CREATED' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';

export interface OrderRecord {
  orderId: string;
  reservationId: string;
  transactionRef: string;
  userId: string;
  productId: string;
  amount: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderRepository {
  createOrder(order: OrderRecord): Promise<OrderRecord>;
  getById(orderId: string): Promise<OrderRecord | null>;
  getByTransactionRef(ref: string): Promise<OrderRecord | null>;
  getByReservationId(reservationId: string): Promise<OrderRecord | null>;
}

export class InMemoryOrderRepository implements IOrderRepository {
  private byId: Map<string, OrderRecord> = new Map();
  private byTxRef: Map<string, OrderRecord> = new Map();
  private byReservationId: Map<string, OrderRecord> = new Map();

  async createOrder(order: OrderRecord): Promise<OrderRecord> {
    const copy = { ...order };
    this.byId.set(copy.orderId, copy);
    this.byTxRef.set(copy.transactionRef, copy);
    this.byReservationId.set(copy.reservationId, copy);
    return { ...copy };
  }

  async getById(orderId: string): Promise<OrderRecord | null> {
    const record = this.byId.get(orderId);
    return record ? { ...record } : null;
  }

  async getByTransactionRef(ref: string): Promise<OrderRecord | null> {
    const record = this.byTxRef.get(ref);
    return record ? { ...record } : null;
  }

  async getByReservationId(reservationId: string): Promise<OrderRecord | null> {
    const record = this.byReservationId.get(reservationId);
    return record ? { ...record } : null;
  }
}

export type InventoryStatus = 'AVAILABLE' | 'OUT_OF_STOCK';

export type ReservationStatus = 
  | 'RESERVED' 
  | 'PAYMENT_PENDING' 
  | 'CONFIRMED' 
  | 'SOLD' 
  | 'PAYMENT_FAILED' 
  | 'TIMEOUT' 
  | 'RELEASED';

export interface InventoryRecord {
  productId: string;
  totalQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  status: InventoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReservationRecord {
  reservationId: string;
  idempotencyKey: string;
  productId: string;
  userId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReserveRequest {
  idempotencyKey: string;
  productId: string;
  userId: string;
  quantity: number;
  ttlMs?: number; // default e.g. 10 mins (600,000ms)
}

export interface ReserveResult {
  success: boolean;
  reservation?: ReservationRecord;
  reason?: 'OUT_OF_STOCK' | 'IDEMPOTENT_REPLAY' | 'INVALID_QUANTITY' | 'PRODUCT_NOT_FOUND';
  isDuplicate?: boolean;
}

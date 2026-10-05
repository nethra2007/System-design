export interface TelemetryMetrics {
  stock: {
    available: number;
    reserved: number;
    sold: number;
    released: number;
    initial: number;
  };
  traffic: {
    incoming: number;
    rps: number;
    active: number;
    queued: number;
    rejected: number;
  };
  reservations: {
    successful: number;
    failed: number;
    expired: number;
    duplicate: number;
  };
  payments: {
    success: number;
    failure: number;
    timeout: number;
    duplicate: number;
  };
  orders: {
    created: number;
    pending: number;
    confirmed: number;
    processing: number;
    shipped: number;
    delivered: number;
  };
  systemHealth: {
    gateway: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    inventory: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    payment: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    order: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    redis: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    postgres: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    eventBus: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  };
}

export interface LiveEvent {
  id: string;
  type: 
    | 'REQUEST_RECEIVED' 
    | 'RESERVATION_CREATED' 
    | 'RESERVATION_REJECTED' 
    | 'DUPLICATE_REQUEST' 
    | 'PAYMENT_STARTED' 
    | 'PAYMENT_SUCCESS' 
    | 'PAYMENT_FAILED' 
    | 'RESERVATION_RELEASED' 
    | 'ORDER_CREATED' 
    | 'ORDER_RECOVERY_STARTED' 
    | 'ORDER_CONFIRMED';
  details: string;
  timestamp: string;
}

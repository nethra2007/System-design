export interface PaymentSucceededEventPayload {
  eventId: string;
  transactionRef: string;
  reservationId: string;
  productId: string;
  userId: string;
  amount: number;
  idempotencyKey: string;
  timestamp: string;
}

export interface PaymentFailedEventPayload {
  eventId: string;
  transactionRef?: string;
  reservationId: string;
  productId: string;
  userId: string;
  amount: number;
  reason: string;
  timestamp: string;
}

export interface OrderCreatedEventPayload {
  eventId: string;
  orderId: string;
  reservationId: string;
  transactionRef: string;
  userId: string;
  productId: string;
  amount: number;
  status: string;
  timestamp: string;
}

export interface IEventBus {
  publish<T>(streamName: string, eventType: string, payload: T): Promise<string>;
  subscribe<T>(
    streamName: string,
    consumerGroup: string,
    consumerName: string,
    handler: (event: { messageId: string; eventType: string; payload: T }) => Promise<boolean>
  ): Promise<void>;
  getPendingMessages<T>(
    streamName: string,
    consumerGroup: string,
    consumerName: string
  ): Promise<Array<{ messageId: string; eventType: string; payload: T }>>;
}

export class InMemoryEventBus implements IEventBus {
  private streams: Map<string, Array<{ messageId: string; eventType: string; payload: any }>> = new Map();
  private pendingList: Map<string, Array<{ messageId: string; eventType: string; payload: any; consumerGroup: string }>> = new Map();
  private messageCounter = 0;

  private listeners: Map<string, Array<{ consumerGroup: string; handler: Function }>> = new Map();

  async publish<T>(streamName: string, eventType: string, payload: T): Promise<string> {
    if (!this.streams.has(streamName)) {
      this.streams.set(streamName, []);
    }
    const messageId = `${Date.now()}-${++this.messageCounter}`;
    const entry = { messageId, eventType, payload };
    this.streams.get(streamName)!.push(entry);

    const streamListeners = this.listeners.get(streamName) || [];
    for (const listener of streamListeners) {
      const key = `${streamName}:${listener.consumerGroup}`;
      if (!this.pendingList.has(key)) {
        this.pendingList.set(key, []);
      }
      const processed = await listener.handler(entry);
      if (!processed) {
        const existingPending = this.pendingList.get(key)!;
        if (!existingPending.some((p) => p.messageId === messageId)) {
          existingPending.push({ ...entry, consumerGroup: listener.consumerGroup });
        }
      }
    }

    return messageId;
  }

  async subscribe<T>(
    streamName: string,
    consumerGroup: string,
    consumerName: string,
    handler: (event: { messageId: string; eventType: string; payload: T }) => Promise<boolean>
  ): Promise<void> {
    if (!this.listeners.has(streamName)) {
      this.listeners.set(streamName, []);
    }
    this.listeners.get(streamName)!.push({ consumerGroup, handler });

    const stream = this.streams.get(streamName) || [];
    const key = `${streamName}:${consumerGroup}`;
    
    if (!this.pendingList.has(key)) {
      this.pendingList.set(key, []);
    }

    for (const msg of stream) {
      const processed = await handler(msg);
      if (!processed) {
        // Retain in pending list for recovery/retry
        const existingPending = this.pendingList.get(key)!;
        if (!existingPending.some((p) => p.messageId === msg.messageId)) {
          existingPending.push({ ...msg, consumerGroup });
        }
      }
    }
  }

  async getPendingMessages<T>(
    streamName: string,
    consumerGroup: string,
    _consumerName: string
  ): Promise<Array<{ messageId: string; eventType: string; payload: T }>> {
    const key = `${streamName}:${consumerGroup}`;
    const pending = this.pendingList.get(key) || [];
    return pending.map((p) => ({ messageId: p.messageId, eventType: p.eventType, payload: p.payload }));
  }

  async clearPending(streamName: string, consumerGroup: string, messageId: string): Promise<void> {
    const key = `${streamName}:${consumerGroup}`;
    const pending = this.pendingList.get(key) || [];
    this.pendingList.set(
      key,
      pending.filter((p) => p.messageId !== messageId)
    );
  }
}

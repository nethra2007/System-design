import { ReservationRecord, ReservationStatus } from './types';

export interface IReservationRepository {
  createReservation(reservation: ReservationRecord): Promise<ReservationRecord>;
  getByIdempotencyKey(key: string): Promise<ReservationRecord | null>;
  getById(reservationId: string): Promise<ReservationRecord | null>;
  updateStatus(reservationId: string, status: ReservationStatus): Promise<ReservationRecord | null>;
  findExpiredReservations(now: Date): Promise<ReservationRecord[]>;
}

export class InMemoryReservationRepository implements IReservationRepository {
  private reservationsById: Map<string, ReservationRecord> = new Map();
  private reservationsByIdempotencyKey: Map<string, ReservationRecord> = new Map();
  private lock: Promise<void> = Promise.resolve();

  private async withLock<T>(fn: () => T): Promise<T> {
    let release!: () => void;
    const nextLock = new Promise<void>((res) => { release = res; });
    const currentLock = this.lock;
    this.lock = nextLock;
    await currentLock;
    try {
      return fn();
    } finally {
      release();
    }
  }

  async createReservation(reservation: ReservationRecord): Promise<ReservationRecord> {
    return this.withLock(() => {
      const copy = { ...reservation };
      this.reservationsById.set(copy.reservationId, copy);
      this.reservationsByIdempotencyKey.set(copy.idempotencyKey, copy);
      return { ...copy };
    });
  }

  async getByIdempotencyKey(key: string): Promise<ReservationRecord | null> {
    return this.withLock(() => {
      const record = this.reservationsByIdempotencyKey.get(key);
      return record ? { ...record } : null;
    });
  }

  async getById(reservationId: string): Promise<ReservationRecord | null> {
    return this.withLock(() => {
      const record = this.reservationsById.get(reservationId);
      return record ? { ...record } : null;
    });
  }

  async updateStatus(reservationId: string, status: ReservationStatus): Promise<ReservationRecord | null> {
    return this.withLock(() => {
      const record = this.reservationsById.get(reservationId);
      if (!record) return null;
      record.status = status;
      record.updatedAt = new Date();
      return { ...record };
    });
  }

  async findExpiredReservations(now: Date): Promise<ReservationRecord[]> {
    return this.withLock(() => {
      const expired: ReservationRecord[] = [];
      for (const res of this.reservationsById.values()) {
        if (
          (res.status === 'RESERVED' || res.status === 'PAYMENT_PENDING') &&
          res.expiresAt <= now
        ) {
          expired.push({ ...res });
        }
      }
      return expired;
    });
  }
}

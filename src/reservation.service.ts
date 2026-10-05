import { IInventoryRepository } from './inventory.repository';
import { IReservationRepository } from './reservation.repository';
import { ReserveRequest, ReserveResult, ReservationRecord } from './types';
import { randomUUID } from 'crypto';

export class ReservationService {
  constructor(
    private inventoryRepo: IInventoryRepository,
    private reservationRepo: IReservationRepository
  ) {}

  /**
   * Core Reservation Flow with Atomic DB Locking & Idempotency Key Handling
   */
  async reserve(req: ReserveRequest): Promise<ReserveResult> {
    if (req.quantity <= 0) {
      return { success: false, reason: 'INVALID_QUANTITY' };
    }

    // 1. Check Idempotency Key
    const existing = await this.reservationRepo.getByIdempotencyKey(req.idempotencyKey);
    if (existing) {
      return {
        success: existing.status !== 'RELEASED' && existing.status !== 'PAYMENT_FAILED' && existing.status !== 'TIMEOUT',
        reservation: existing,
        reason: 'IDEMPOTENT_REPLAY',
        isDuplicate: true
      };
    }

    // 2. Perform Atomic Reservation Invariant Assertion
    const reservedSuccess = await this.inventoryRepo.atomicReserve(req.productId, req.quantity);
    if (!reservedSuccess) {
      return { success: false, reason: 'OUT_OF_STOCK' };
    }

    // 3. Create Reservation Record
    const ttl = req.ttlMs ?? 600000; // Default 10 minutes TTL
    const reservation: ReservationRecord = {
      reservationId: randomUUID(),
      idempotencyKey: req.idempotencyKey,
      productId: req.productId,
      userId: req.userId,
      quantity: req.quantity,
      status: 'RESERVED',
      expiresAt: new Date(Date.now() + ttl),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const saved = await this.reservationRepo.createReservation(reservation);
    return { success: true, reservation: saved };
  }

  /**
   * Transition to PAYMENT_PENDING state
   */
  async markPaymentPending(reservationId: string): Promise<ReservationRecord | null> {
    const res = await this.reservationRepo.getById(reservationId);
    if (!res || res.status !== 'RESERVED') return null;
    return this.reservationRepo.updateStatus(reservationId, 'PAYMENT_PENDING');
  }

  /**
   * Confirm reservation upon payment success -> CONFIRMED -> SOLD
   */
  async confirmReservation(reservationId: string): Promise<ReservationRecord | null> {
    const res = await this.reservationRepo.getById(reservationId);
    if (!res) return null;

    if (res.status === 'CONFIRMED' || res.status === 'SOLD') {
      return res; // Idempotent return
    }

    if (res.status !== 'RESERVED' && res.status !== 'PAYMENT_PENDING') {
      return null;
    }

    // Atomic move reserved -> sold quantity in DB
    await this.inventoryRepo.atomicConfirmSale(res.productId, res.quantity);
    await this.reservationRepo.updateStatus(reservationId, 'CONFIRMED');
    return this.reservationRepo.updateStatus(reservationId, 'SOLD');
  }

  /**
   * Handle payment failure path -> PAYMENT_FAILED -> RELEASED
   */
  async handlePaymentFailure(reservationId: string): Promise<ReservationRecord | null> {
    const res = await this.reservationRepo.getById(reservationId);
    if (!res || res.status === 'RELEASED' || res.status === 'SOLD') return res;

    // Release reserved inventory back to pool
    await this.inventoryRepo.atomicRelease(res.productId, res.quantity);
    await this.reservationRepo.updateStatus(reservationId, 'PAYMENT_FAILED');
    return this.reservationRepo.updateStatus(reservationId, 'RELEASED');
  }

  /**
   * Background Expiry Worker / Timeout Handler -> TIMEOUT -> RELEASED
   */
  async expireStaleReservations(now: Date = new Date()): Promise<number> {
    const expiredList = await this.reservationRepo.findExpiredReservations(now);
    let count = 0;

    for (const res of expiredList) {
      // Release inventory atomically
      await this.inventoryRepo.atomicRelease(res.productId, res.quantity);
      await this.reservationRepo.updateStatus(res.reservationId, 'TIMEOUT');
      await this.reservationRepo.updateStatus(res.reservationId, 'RELEASED');
      count++;
    }

    return count;
  }
}

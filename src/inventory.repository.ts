import { InventoryRecord } from './types';

export interface IInventoryRepository {
  initProductInventory(productId: string, initialQuantity: number): Promise<InventoryRecord>;
  getInventory(productId: string): Promise<InventoryRecord | null>;
  atomicReserve(productId: string, quantity: number): Promise<boolean>;
  atomicRelease(productId: string, quantity: number): Promise<boolean>;
  atomicConfirmSale(productId: string, quantity: number): Promise<boolean>;
}

export class InMemoryInventoryRepository implements IInventoryRepository {
  private inventoryMap: Map<string, InventoryRecord> = new Map();
  // Simulated Mutex lock per product to mimic PostgreSQL atomic row-level isolation
  private productLocks: Map<string, Promise<void>> = new Map();

  private async acquireLock(productId: string): Promise<() => void> {
    while (this.productLocks.has(productId)) {
      await this.productLocks.get(productId);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.productLocks.set(productId, lockPromise);

    return () => {
      this.productLocks.delete(productId);
      resolveLock();
    };
  }

  async initProductInventory(productId: string, initialQuantity: number): Promise<InventoryRecord> {
    const release = await this.acquireLock(productId);
    try {
      const record: InventoryRecord = {
        productId,
        totalQuantity: initialQuantity,
        reservedQuantity: 0,
        soldQuantity: 0,
        status: initialQuantity > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.inventoryMap.set(productId, record);
      return { ...record };
    } finally {
      release();
    }
  }

  async getInventory(productId: string): Promise<InventoryRecord | null> {
    const record = this.inventoryMap.get(productId);
    return record ? { ...record } : null;
  }

  /**
   * Simulates SQL Atomic Conditional Update:
   * UPDATE inventory SET reserved = reserved + qty 
   * WHERE product_id = :id AND (total - reserved - sold) >= qty
   */
  async atomicReserve(productId: string, quantity: number): Promise<boolean> {
    const release = await this.acquireLock(productId);
    try {
      const record = this.inventoryMap.get(productId);
      if (!record) return false;

      const available = record.totalQuantity - record.reservedQuantity - record.soldQuantity;
      if (available >= quantity) {
        record.reservedQuantity += quantity;
        record.updatedAt = new Date();
        if (record.totalQuantity - record.reservedQuantity - record.soldQuantity <= 0) {
          record.status = 'OUT_OF_STOCK';
        }
        return true;
      }
      return false;
    } finally {
      release();
    }
  }

  /**
   * Atomic stock release (e.g. timeout or payment failed)
   */
  async atomicRelease(productId: string, quantity: number): Promise<boolean> {
    const release = await this.acquireLock(productId);
    try {
      const record = this.inventoryMap.get(productId);
      if (!record) return false;

      record.reservedQuantity = Math.max(0, record.reservedQuantity - quantity);
      record.updatedAt = new Date();
      if (record.totalQuantity - record.reservedQuantity - record.soldQuantity > 0) {
        record.status = 'AVAILABLE';
      }
      return true;
    } finally {
      release();
    }
  }

  /**
   * Atomic sale confirmation: Moves stock from reserved to sold
   */
  async atomicConfirmSale(productId: string, quantity: number): Promise<boolean> {
    const release = await this.acquireLock(productId);
    try {
      const record = this.inventoryMap.get(productId);
      if (!record) return false;

      record.reservedQuantity = Math.max(0, record.reservedQuantity - quantity);
      record.soldQuantity += quantity;
      record.updatedAt = new Date();
      return true;
    } finally {
      release();
    }
  }
}

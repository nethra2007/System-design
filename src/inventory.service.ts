import { IInventoryRepository } from './inventory.repository';
import { InventoryRecord } from './types';

export class InventoryService {
  constructor(private inventoryRepo: IInventoryRepository) {}

  async setupInventory(productId: string, initialQuantity: number): Promise<InventoryRecord> {
    return this.inventoryRepo.initProductInventory(productId, initialQuantity);
  }

  async getInventory(productId: string): Promise<InventoryRecord | null> {
    return this.inventoryRepo.getInventory(productId);
  }
}

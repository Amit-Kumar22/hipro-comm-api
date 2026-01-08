import { Product, Inventory } from '../models';

export class StockManager {
  /**
   * Ensure inventory record exists for a product
   */
  static async ensureInventoryRecord(productId: string) {
    const product = await Product.findById(productId);
    if (!product) return null;

    let inventory = await Inventory.findOne({ product: productId });
    
    if (!inventory) {
      // Create new inventory record
      inventory = new Inventory({
        product: productId,
        sku: product.sku,
        quantityAvailable: product.stock?.quantity || 0,
        quantityReserved: product.stock?.reserved || 0,
        reorderLevel: 10,
        maxStockLevel: 1000,
        location: {
          warehouse: 'Main Warehouse',
          section: 'A',
          shelf: '1'
        },
        supplier: {
          name: 'Default Supplier',
          contact: 'supplier@example.com',
          leadTime: 7
        }
      });
      await inventory.save();
    }

    return inventory;
  }

  /**
   * Reserve stock for an order item
   */
  static async reserveStock(productId: string, quantity: number): Promise<boolean> {
    const product = await Product.findById(productId);
    if (!product || product.stock.available < quantity) {
      return false;
    }

    // Update product stock
    product.stock.reserved += quantity;
    product.stock.available = Math.max(0, product.stock.quantity - product.stock.reserved);
    product.inStock = product.stock.available > 0;
    await product.save();

    // Update inventory record
    const inventory = await this.ensureInventoryRecord(productId);
    if (inventory) {
      inventory.quantityReserved = product.stock.reserved;
      inventory.quantityAvailable = product.stock.available;
      await inventory.save();
    }

    return true;
  }

  /**
   * Release reserved stock
   */
  static async releaseStock(productId: string, quantity: number): Promise<boolean> {
    const product = await Product.findById(productId);
    if (!product) return false;

    // Update product stock
    product.stock.reserved = Math.max(0, product.stock.reserved - quantity);
    product.stock.available = Math.max(0, product.stock.quantity - product.stock.reserved);
    product.inStock = product.stock.available > 0;
    await product.save();

    // Update inventory record
    const inventory = await this.ensureInventoryRecord(productId);
    if (inventory) {
      inventory.quantityReserved = product.stock.reserved;
      inventory.quantityAvailable = product.stock.available;
      await inventory.save();
    }

    return true;
  }

  /**
   * Confirm sale - reduce actual stock quantity
   */
  static async confirmSale(productId: string, quantity: number): Promise<boolean> {
    const product = await Product.findById(productId);
    if (!product || product.stock.quantity < quantity) {
      return false;
    }

    // Update product stock - reduce both quantity and reserved
    product.stock.quantity -= quantity;
    product.stock.reserved = Math.max(0, product.stock.reserved - quantity);
    product.stock.available = Math.max(0, product.stock.quantity - product.stock.reserved);
    product.inStock = product.stock.available > 0;
    await product.save();

    // Update inventory record
    const inventory = await this.ensureInventoryRecord(productId);
    if (inventory) {
      inventory.quantityAvailable = product.stock.available;
      inventory.quantityReserved = product.stock.reserved;
      await inventory.save();
    }

    return true;
  }

  /**
   * Sync all inventory records with product stock levels
   */
  static async syncAllInventory(): Promise<{ success: number; failed: number }> {
    const products = await Product.find({ isActive: true });
    let success = 0;
    let failed = 0;

    for (const product of products) {
      try {
        await this.ensureInventoryRecord(product._id.toString());
        success++;
      } catch (error) {
        console.error(`Failed to sync inventory for product ${product._id}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }
}
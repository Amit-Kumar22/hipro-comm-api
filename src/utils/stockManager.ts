import { Product, Inventory } from '../models';

export class StockManager {
  static async ensureInventoryRecord(productId: string) {
    const product = await Product.findById(productId);
    if (!product) return null;

    let inventory = await Inventory.findOne({ product: productId });
    
    if (!inventory) {
      inventory = new Inventory({
        product: productId,
        sku: product.sku,
        quantityAvailable: product.stock?.available || 0,
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

  static async getAvailableStock(productId: string): Promise<number> {
    const product = await Product.findById(productId);
    if (!product) return 0;

    const inventory = await Inventory.findOne({ product: productId });
    if (inventory?.quantityAvailable !== undefined) {
      return inventory.quantityAvailable;
    }

    if (product.stock?.available !== undefined) {
      return product.stock.available;
    }

    if (product.stock?.quantity !== undefined) {
      return Math.max(0, product.stock.quantity - (product.stock.reserved || 0));
    }

    return 0;
  }

  static async reserveStock(productId: string, quantity: number): Promise<boolean> {
    const product = await Product.findById(productId);
    if (!product || (product.stock?.available || 0) < quantity) {
      return false;
    }

    if (product.stock) {
      product.stock.reserved = (product.stock.reserved || 0) + quantity;
      product.stock.available = Math.max(0, product.stock.quantity - product.stock.reserved);
      product.inStock = product.stock.available > 0;
      await product.save();
    }

    return true;
  }

  static async releaseStock(productId: string, quantity: number): Promise<boolean> {
    const product = await Product.findById(productId);
    if (!product) return false;

    if (product.stock) {
      product.stock.reserved = Math.max(0, (product.stock.reserved || 0) - quantity);
      product.stock.available = Math.max(0, product.stock.quantity - product.stock.reserved);
      product.inStock = product.stock.available > 0;
      await product.save();
    }

    return true;
  }

  static async confirmSale(productId: string, quantity: number): Promise<boolean> {
    const product = await Product.findById(productId);
    if (!product || (product.stock?.quantity || 0) < quantity) {
      return false;
    }

    if (product.stock) {
      product.stock.quantity -= quantity;
      product.stock.reserved = Math.max(0, (product.stock.reserved || 0) - quantity);
      product.stock.available = Math.max(0, product.stock.quantity - product.stock.reserved);
      product.inStock = product.stock.available > 0;
      await product.save();
    }

    return true;
  }
}

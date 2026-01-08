import { Request, Response, NextFunction } from 'express';
import { Order, Product, Inventory } from '../models';

/**
 * Middleware to automatically sync stock levels when order status changes
 */
export const stockSyncMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if this is an order status update
    const { orderId } = req.params;
    const { status: newStatus } = req.body;
    
    if (!orderId || !newStatus) {
      return next();
    }

    // Get the order to check previous status
    const order = await Order.findById(orderId);
    if (!order) {
      return next();
    }

    const previousStatus = order.status;
    
    // Store the previous status for comparison after the order is updated
    res.locals.previousOrderStatus = previousStatus;
    res.locals.newOrderStatus = newStatus;
    res.locals.orderId = orderId;
    
    next();
  } catch (error) {
    console.error('Stock sync middleware error:', error);
    next(); // Continue even if middleware fails
  }
};

/**
 * Post-processing middleware to sync stock after order update
 */
export const postStockSyncMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { previousOrderStatus, newOrderStatus, orderId } = res.locals;
    
    if (!orderId || !previousOrderStatus || !newOrderStatus) {
      return next();
    }

    // Get the updated order with items
    const order = await Order.findById(orderId);
    if (!order) {
      return next();
    }

    console.log(`Processing stock sync for order ${order.orderNumber}: ${previousOrderStatus} → ${newOrderStatus}`);

    // Handle stock changes based on status transitions
    switch (newOrderStatus) {
      case 'PAID':
        // When order is paid, confirm the sale (reduce available stock)
        if (previousOrderStatus === 'PENDING') {
          await order.confirmSale();
          console.log(`Stock confirmed for order ${order.orderNumber}`);
        }
        break;
        
      case 'CANCELLED':
        // When order is cancelled, release reserved stock
        if (['PENDING', 'PAID'].includes(previousOrderStatus)) {
          await order.releaseStock();
          console.log(`Stock released for cancelled order ${order.orderNumber}`);
        }
        break;
        
      case 'DELIVERED':
        // Ensure sale is confirmed when delivered (in case payment was COD)
        if (order.paymentMethod === 'cod' && previousOrderStatus === 'SHIPPED') {
          await order.confirmSale();
          console.log(`COD sale confirmed for delivered order ${order.orderNumber}`);
        }
        break;
    }

    // Sync with inventory system
    await syncInventoryWithProducts(order.items.map(item => item.product as any));

    next();
  } catch (error) {
    console.error('Post stock sync middleware error:', error);
    next(); // Continue even if sync fails
  }
};

/**
 * Sync inventory records with current product stock levels
 */
async function syncInventoryWithProducts(productIds: string[]) {
  try {
    for (const productId of productIds) {
      const product = await Product.findById(productId);
      if (!product) continue;

      let inventory = await Inventory.findOne({ product: productId });
      
      if (!inventory) {
        // Create new inventory record if it doesn't exist
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
      } else {
        // Update existing inventory with current product stock
        inventory.quantityAvailable = product.stock?.available || 0;
        inventory.quantityReserved = product.stock?.reserved || 0;
      }

      await inventory.save();
    }
  } catch (error) {
    console.error('Error syncing inventory with products:', error);
  }
}

export { syncInventoryWithProducts };
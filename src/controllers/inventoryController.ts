import { Request, Response } from 'express';
import { z } from 'zod';
import { Inventory, Product } from '../models';
import { 
  asyncHandler, 
  ValidationError, 
  NotFoundError 
} from '../middleware/errorMiddleware';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { calculatePagination } from '../utils/helpers.js';

// Validation schema for inventory operations
const updateInventorySchema = z.object({
  quantityAvailable: z.number().min(0, 'Available quantity cannot be negative').optional(),
  reorderLevel: z.number().min(0, 'Reorder level cannot be negative').optional(),
  maxStockLevel: z.number().min(1, 'Max stock level must be at least 1').optional(),
  location: z.object({
    warehouse: z.string().min(1, 'Warehouse is required'),
    section: z.string().min(1, 'Section is required'),
    shelf: z.string().min(1, 'Shelf is required')
  }).optional(),
  supplier: z.object({
    name: z.string().min(1, 'Supplier name is required'),
    contact: z.string().min(1, 'Supplier contact is required'),
    leadTime: z.number().min(1, 'Lead time must be at least 1 day')
  }).optional()
});

const stockAdjustmentSchema = z.object({
  adjustment: z.number().refine(val => val !== 0, 'Adjustment cannot be zero'),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional()
});

/**
 * @swagger
 * /api/v1/inventory:
 *   get:
 *     summary: Get all inventory items with filtering and pagination
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: outOfStock
 *         schema:
 *           type: boolean
 */
export const getInventory = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    lowStock,
    outOfStock,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build filter query
  const filter: any = { isActive: true };

  // Search in product name or SKU
  if (search) {
    const searchRegex = new RegExp(search.toString(), 'i');
    const products = await Product.find({ 
      $or: [
        { name: searchRegex },
        { sku: searchRegex }
      ]
    }, '_id');
    
    const productIds = products.map(p => p._id);
    filter.$or = [
      { sku: searchRegex },
      { product: { $in: productIds } }
    ];
  }

  // Count total documents
  const totalCount = await Inventory.countDocuments(filter);
  const pagination = calculatePagination(Number(page), Number(limit), totalCount);

  // Build sort object
  const sort: any = {};
  sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

  // Query inventory with product details
  let inventory = await Inventory.find(filter)
    .populate('product', 'name slug sku price images')
    .sort(sort)
    .skip(pagination.skip)
    .limit(pagination.limit);

  // Apply stock filters after population to use virtual fields
  if (lowStock === 'true') {
    inventory = inventory.filter(item => item.isLowStock);
  }
  
  if (outOfStock === 'true') {
    inventory = inventory.filter(item => item.isOutOfStock);
  }

  res.json({
    success: true,
    data: {
      inventory,
      pagination: {
        ...pagination,
        totalCount: lowStock === 'true' || outOfStock === 'true' ? inventory.length : totalCount
      }
    }
  });
});

/**
 * @swagger
 * /api/v1/inventory/{id}:
 *   get:
 *     summary: Get inventory item by ID
 */
export const getInventoryItem = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const inventory = await Inventory.findById(id)
    .populate('product', 'name slug sku price images description');

  if (!inventory) {
    throw new NotFoundError('Inventory item not found');
  }

  res.json({
    success: true,
    data: inventory
  });
});

/**
 * @swagger
 * /api/v1/inventory/{id}:
 *   put:
 *     summary: Update inventory item (Admin only)
 */
export const updateInventory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const validatedData = updateInventorySchema.parse(req.body);

  const inventory = await Inventory.findById(id);
  if (!inventory) {
    throw new NotFoundError('Inventory item not found');
  }

  // Validate max stock level vs reorder level
  if (validatedData.maxStockLevel && validatedData.reorderLevel) {
    if (validatedData.maxStockLevel <= validatedData.reorderLevel) {
      throw new ValidationError('Max stock level must be greater than reorder level');
    }
  } else if (validatedData.maxStockLevel && validatedData.maxStockLevel <= inventory.reorderLevel) {
    throw new ValidationError('Max stock level must be greater than current reorder level');
  } else if (validatedData.reorderLevel && validatedData.reorderLevel >= inventory.maxStockLevel) {
    throw new ValidationError('Reorder level must be less than current max stock level');
  }

  const updatedInventory = await Inventory.findByIdAndUpdate(
    id,
    { ...validatedData, lastRestocked: validatedData.quantityAvailable ? new Date() : inventory.lastRestocked },
    { new: true, runValidators: true }
  ).populate('product', 'name slug sku');

  res.json({
    success: true,
    data: updatedInventory
  });
});

/**
 * @swagger
 * /api/v1/inventory/{id}/adjust:
 *   post:
 *     summary: Adjust stock quantity (Admin only)
 */
export const adjustStock = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const validatedData = stockAdjustmentSchema.parse(req.body);

  const inventory = await Inventory.findById(id).populate('product', 'name sku');
  if (!inventory) {
    throw new NotFoundError('Inventory item not found');
  }

  const newQuantity = inventory.quantityAvailable + validatedData.adjustment;
  
  if (newQuantity < 0) {
    throw new ValidationError('Adjustment would result in negative stock');
  }

  if (newQuantity > inventory.maxStockLevel) {
    throw new ValidationError(`Adjustment would exceed max stock level (${inventory.maxStockLevel})`);
  }

  inventory.quantityAvailable = newQuantity;
  inventory.lastRestocked = new Date();
  await inventory.save();

  // Log the adjustment (you could create an audit log model for this)
  console.log(`Stock adjusted for product ${inventory.sku}: ${validatedData.adjustment > 0 ? '+' : ''}${validatedData.adjustment} units. Reason: ${validatedData.reason}`);

  res.json({
    success: true,
    data: inventory,
    message: `Stock ${validatedData.adjustment > 0 ? 'increased' : 'decreased'} by ${Math.abs(validatedData.adjustment)} units`
  });
});

/**
 * @swagger
 * /api/v1/inventory/low-stock:
 *   get:
 *     summary: Get low stock items
 */
export const getLowStockItems = asyncHandler(async (req: Request, res: Response) => {
  const inventory = await Inventory.find({ isActive: true })
    .populate('product', 'name slug sku price images')
    .sort({ quantityAvailable: 1 });

  const lowStockItems = inventory.filter(item => item.isLowStock);

  res.json({
    success: true,
    data: lowStockItems
  });
});

/**
 * @swagger
 * /api/v1/inventory/stats:
 *   get:
 *     summary: Get inventory statistics
 */
export const getInventoryStats = asyncHandler(async (req: Request, res: Response) => {
  const inventory = await Inventory.find({ isActive: true });
  
  const stats = {
    totalProducts: inventory.length,
    totalStock: inventory.reduce((sum, item) => sum + item.totalStock, 0),
    totalValue: 0, // Would need product prices
    lowStockItems: inventory.filter(item => item.isLowStock).length,
    outOfStockItems: inventory.filter(item => item.isOutOfStock).length,
    averageStockLevel: inventory.length > 0 ? 
      inventory.reduce((sum, item) => sum + item.quantityAvailable, 0) / inventory.length : 0
  };

  res.json({
    success: true,
    data: stats
  });
});

/**
 * @swagger
 * /api/v1/inventory/bulk-update:
 *   post:
 *     summary: Bulk update multiple inventory items
 */
export const bulkUpdateInventory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { updates } = req.body;
  
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new ValidationError('Updates array is required');
  }

  const results = [];
  
  for (const update of updates) {
    try {
      const { id, ...updateData } = update;
      const validatedData = updateInventorySchema.parse(updateData);
      
      const updatedItem = await Inventory.findByIdAndUpdate(
        id,
        { ...validatedData, lastRestocked: validatedData.quantityAvailable ? new Date() : undefined },
        { new: true, runValidators: true }
      ).populate('product', 'name sku');
      
      results.push({ id, success: true, data: updatedItem });
    } catch (error: any) {
      results.push({ id: update.id, success: false, error: error?.message || 'Unknown error' });
    }
  }

  res.json({
    success: true,
    data: results
  });
});

/**
 * @swagger
 * /api/v1/inventory/sync:
 *   post:
 *     summary: Synchronize inventory with product stock levels
 */
export const syncInventory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { StockManager } = await import('../utils/stockManager');
    const results = await StockManager.syncAllInventory();

    res.json({
      success: true,
      message: `Inventory sync completed: ${results.success} successful, ${results.failed} failed`,
      data: results
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to sync inventory',
      error: error.message
    });
  }
});
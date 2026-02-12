import { Request, Response } from 'express';
import { z } from 'zod';
import { Product, Category, Inventory } from '../models';
import { 
  asyncHandler, 
  ValidationError, 
  NotFoundError,
  BadRequestError
} from '../middleware/errorMiddleware';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { 
  calculatePagination, 
  generateSlug, 
  generateSKU,
  parseStandardizedQuery,
  buildSortObject,
  buildSearchFilter,
  createStandardizedResponse
} from '../utils/helpers.js';

// Validation schema for creating products
const createProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters'), // Removed max limit
  shortDescription: z.string().min(10, 'Short description must be at least 10 characters'), // Removed max limit
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID'),
  images: z.array(z.object({
    url: z.string().url('Invalid image URL'),
    alt: z.string().min(1, 'Alt text is required'),
    isPrimary: z.boolean().default(false)
  })).min(1, 'At least one image is required'),
  video: z.object({
    url: z.string().url('Invalid video URL'),
    title: z.string().optional(),
    duration: z.number().optional(),
    size: z.number().optional(),
    format: z.string().optional()
  }).optional(),
  price: z.object({
    original: z.number().min(0, 'Original price cannot be negative'),
    selling: z.number().min(0, 'Selling price cannot be negative')
  }),
  specifications: z.array(z.object({
    key: z.string().min(1, 'Specification key is required'),
    value: z.string().min(1, 'Specification value is required')
  })).optional(),
  variants: z.array(z.object({
    name: z.string().min(1, 'Variant name is required'),
    options: z.array(z.object({
      name: z.string().min(1, 'Option name is required'),
      value: z.string().min(1, 'Option value is required'),
      priceAdjustment: z.number().default(0),
      sku: z.string().min(1, 'SKU is required')
    }))
  })).optional(),
  dimensions: z.object({
    length: z.number().min(0),
    width: z.number().min(0),
    height: z.number().min(0),
    weight: z.number().min(0),
    unit: z.enum(['cm', 'inch']).default('cm'),
    weightUnit: z.enum(['kg', 'lbs']).default('kg')
  }),
  tags: z.array(z.string()).optional(),
  isFeatured: z.boolean().default(false),
  seo: z.object({
    metaTitle: z.string().max(60).optional(),
    metaDescription: z.string().max(160).optional(),
    metaKeywords: z.array(z.string()).optional()
  }).optional(),
  returnPolicy: z.string().optional(),
  whatsInTheBox: z.array(z.object({
    component: z.string().min(1, 'Component name is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1')
  })).optional(),
  // Inventory data
  initialStock: z.number().min(0, 'Initial stock cannot be negative').default(0),
  reorderLevel: z.number().min(0, 'Reorder level cannot be negative').default(10),
  maxStockLevel: z.number().min(1, 'Max stock level must be at least 1').default(1000)
});

// Validation schema for updating products
const updateProductSchema = createProductSchema.partial().extend({
  // Allow stock updates
  stockQuantity: z.number().min(0, 'Stock quantity cannot be negative').optional()
});

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     summary: Get all products with filtering and pagination
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of products per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: "createdAt"
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: "desc"
 *         description: Sort order
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search query for product names, descriptions, or SKUs
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *           default: 0
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *           default: 999999
 *         description: Maximum price filter
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Filter featured products only
 *       - in: query
 *         name: inStock
 *         schema:
 *           type: boolean
 *         description: Filter products in stock only
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Filter by product status
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 pageable:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     size:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalElements:
 *                       type: integer
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  // Parse standardized query parameters
  const { page, size, sortBy, sortOrder, search } = parseStandardizedQuery(req.query);
  
  // Extract additional filters
  const {
    category = '',
    minPrice = 0,
    maxPrice = 999999,
    featured,
    inStock,
    isActive
  } = req.query;

  // Build base filter
  const filter: any = {};
  
  // Check if this is an admin request by checking authorization header
  const isAdminRequest = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
  
  // Active status filter logic
  if (isActive !== undefined) {
    // Explicit isActive parameter provided - use it
    const isActiveValue = typeof isActive === 'string' ? isActive === 'true' : !!isActive;
    filter.isActive = isActiveValue;
  } else if (!isAdminRequest) {
    // For public API (non-admin), default to showing only active products
    filter.isActive = true;
  }
  // For admin requests with no explicit isActive parameter, show all products (no isActive filter)
  
  // Search filter
  if (search && search.trim()) {
    const searchFilter = buildSearchFilter(search, ['name', 'description', 'shortDescription', 'sku']);
    Object.assign(filter, searchFilter);
  }
  
  // Category filter
  if (category) {
    filter.category = category;
  }
  
  // Featured filter
  if (featured === 'true') {
    filter.isFeatured = true;
  }
  
  // Price range filter
  filter['price.selling'] = { 
    $gte: Number(minPrice), 
    $lte: Number(maxPrice) 
  };

  // Count total documents matching filter
  const totalElements = await Product.countDocuments(filter);
  const pagination = calculatePagination(page, size, totalElements);

  // Build sort object
  const sort = buildSortObject(sortBy, sortOrder);

  // Query products with pagination
  const products = await Product.find(filter)
    .populate('category', 'name slug')
    .sort(sort)
    .skip(pagination.skip)
    .limit(pagination.size);

  // Get inventory data for all products
  const productIds = products.map(p => p._id);
  const inventoryData = await Inventory.find({ 
    product: { $in: productIds },
    isActive: true 
  });

  // Merge inventory data with products
  const productsWithInventory = products.map(product => {
    const inventory = inventoryData.find(inv => 
      inv.product.toString() === product._id.toString()
    );
    
    return {
      ...product.toObject(),
      inventory: inventory ? {
        availableForSale: inventory.availableForSale,
        quantityAvailable: inventory.quantityAvailable,
        quantityReserved: inventory.quantityReserved,
        isOutOfStock: inventory.isOutOfStock,
        isLowStock: inventory.isLowStock,
        reorderLevel: inventory.reorderLevel
      } : {
        availableForSale: 0,
        quantityAvailable: 0,
        quantityReserved: 0,
        isOutOfStock: true,
        isLowStock: false,
        reorderLevel: 0
      }
    };
  });

  // Apply stock filter if needed (after inventory merge)
  let finalProducts = productsWithInventory;
  if (inStock === 'true') {
    finalProducts = productsWithInventory.filter(product => 
      product.inventory.availableForSale > 0
    );
  }

  // Create standardized response
  const response = createStandardizedResponse(finalProducts, pagination);

  res.json({
    success: true,
    ...response
  });
});

/**
 * @swagger
 * /api/v1/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const product = await Product.findById(id)
    .populate('category', 'name slug description');

  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Get inventory separately
  const inventory = await Inventory.findOne({ product: id, isActive: true });

  res.json({
    success: true,
    data: {
      ...product.toObject(),
      inventory
    }
  });
});

// Get product by slug
export const getProductBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;

  const product = await Product.findOne({ slug, isActive: true })
    .populate('category', 'name slug description');

  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Get inventory separately
  const inventory = await Inventory.findOne({ product: product._id, isActive: true });

  res.json({
    success: true,
    data: {
      ...product.toObject(),
      inventory
    }
  });
});

/**
 * @swagger
 * /api/v1/products:
 *   post:
 *     summary: Create new product (Admin only)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - shortDescription
 *               - categoryId
 *               - images
 *               - price
 *               - dimensions
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *                 example: "iPhone 15 Pro"
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *                 example: "Latest iPhone with advanced camera system"
 *               shortDescription:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 300
 *                 example: "Premium smartphone with cutting-edge features"
 *               categoryId:
 *                 type: string
 *                 example: "64f8b0123456789abcdef123"
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       format: uri
 *                     alt:
 *                       type: string
 *                     isPrimary:
 *                       type: boolean
 *               price:
 *                 type: object
 *                 properties:
 *                   original:
 *                     type: number
 *                     example: 999.99
 *                   selling:
 *                     type: number
 *                     example: 899.99
 *               dimensions:
 *                 type: object
 *                 properties:
 *                   length:
 *                     type: number
 *                   width:
 *                     type: number
 *                   height:
 *                     type: number
 *                   weight:
 *                     type: number
 *                   unit:
 *                     type: string
 *                     enum: [cm, inch]
 *                   weightUnit:
 *                     type: string
 *                     enum: [kg, lbs]
 *               initialStock:
 *                 type: number
 *                 example: 100
 *               isFeatured:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const createProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  console.log('🎬 Received product data:', req.body);
  console.log('🎥 Video field in request:', req.body.video);
  
  const validatedData = createProductSchema.parse(req.body);
  console.log('✅ Validated product data:', validatedData);
  console.log('🎥 Video field after validation:', validatedData.video);

  // Check if category exists
  const category = await Category.findById(validatedData.categoryId);
  if (!category) {
    throw new ValidationError('Category not found');
  }

  // Generate slug and SKU
  const slug = generateSlug(validatedData.name);
  const sku = generateSKU(validatedData.name, category.name);

  // Check if slug already exists
  const existingProduct = await Product.findOne({ slug });
  if (existingProduct) {
    throw new ValidationError('A product with this name already exists');
  }

  // Prepare product data
  const productData = {
    ...validatedData,
    slug,
    sku,
    category: validatedData.categoryId
  };

  // Remove inventory-specific fields from product data
  const { initialStock, reorderLevel, maxStockLevel, ...productOnlyData } = productData;

  // Ensure stock field is properly initialized in product
  const productWithStock = {
    ...productOnlyData,
    stock: {
      quantity: initialStock || 0,
      reserved: 0,
      available: initialStock || 0
    },
    inStock: (initialStock || 0) > 0
  };

  // Create product
  const product = await Product.create(productWithStock);

  // Create inventory record
  await Inventory.create({
    product: product._id,
    sku: product.sku,
    quantityAvailable: initialStock || 0,
    reorderLevel: reorderLevel || 10,
    maxStockLevel: maxStockLevel || 1000,
    supplier: {
      name: 'Default Supplier',
      contact: 'supplier@example.com',
      leadTime: 7
    }
  });

  // Populate the created product
  const populatedProduct = await Product.findById(product._id)
    .populate('category', 'name slug');

  // Get the inventory for response
  const inventory = await Inventory.findOne({ product: product._id });

  console.log('✅ Product Created Successfully:', {
    productId: product._id,
    productName: product.name,
    stockQuantity: product.stock.quantity,
    stockAvailable: product.stock.available,
    inventoryAvailable: inventory?.quantityAvailable,
    inStock: product.inStock
  });

  // Clear all caches for immediate updates
  try {
    const { productionCache } = await import('../utils/productionOptimization');
    await productionCache.clearAllProductCache();
    console.log('🧹 Cache cleared after product creation');
  } catch (error) {
    console.log('⚠️ Cache clear failed:', error);
  }

  res.status(201).json({
    success: true,
    data: {
      ...populatedProduct!.toObject(),
      inventory
    }
  });
});

// Update product (Admin only)
export const updateProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  console.log('🎬 Updating product with data:', req.body);
  console.log('🎥 Video field in update request:', req.body.video);
  
  const validatedData = updateProductSchema.parse(req.body);
  console.log('✅ Validated update data:', validatedData);
  console.log('🎥 Video field after validation:', validatedData.video);

  const product = await Product.findById(id);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // If categoryId is being updated, check if new category exists
  if (validatedData.categoryId) {
    const category = await Category.findById(validatedData.categoryId);
    if (!category) {
      throw new ValidationError('Category not found');
    }
  }

  // Update slug if name is changed
  let updateData: any = validatedData;
  if (validatedData.name && validatedData.name !== product.name) {
    const newSlug = generateSlug(validatedData.name);
    
    // Check if new slug already exists
    const existingProduct = await Product.findOne({ 
      slug: newSlug, 
      _id: { $ne: id } 
    });
    if (existingProduct) {
      throw new ValidationError('A product with this name already exists');
    }
    
    updateData = { ...validatedData, slug: newSlug };
  }

  // Handle stock quantity update
  if (validatedData.stockQuantity !== undefined) {
    updateData.stock = {
      ...product.stock,
      quantity: validatedData.stockQuantity,
      available: Math.max(0, validatedData.stockQuantity - product.stock.reserved)
    };
    updateData.inStock = updateData.stock.available > 0;
    
    // Remove stockQuantity from updateData since it's not a direct product field
    const { stockQuantity, ...productUpdateData } = updateData;
    updateData = productUpdateData;
  }

  // Update product
  const updatedProduct = await Product.findByIdAndUpdate(
    id,
    { ...updateData, category: validatedData.categoryId || updateData.categoryId },
    { new: true, runValidators: true }
  ).populate('category', 'name slug');

  // Update inventory if stock quantity was changed
  if (validatedData.stockQuantity !== undefined) {
    if (!id) {
      throw new ValidationError('Product ID is required');
    }
    const { StockManager } = await import('../utils/stockManager');
    await StockManager.ensureInventoryRecord(id);
    
    // Update inventory record to sync with new product stock
    const inventory = await Inventory.findOne({ product: id });
    if (inventory) {
      inventory.quantityAvailable = updatedProduct!.stock.available;
      inventory.quantityReserved = updatedProduct!.stock.reserved;
      await inventory.save();
    }
  }

  // Clear all caches for immediate updates
  try {
    const { productionCache } = await import('../utils/productionOptimization');
    await productionCache.clearAllProductCache();
    console.log('🧹 Cache cleared after product update');
  } catch (error) {
    console.log('⚠️ Cache clear failed:', error);
  }

  res.json({
    success: true,
    data: updatedProduct,
    message: validatedData.stockQuantity !== undefined ? 
      `Product updated and stock set to ${validatedData.stockQuantity}` : 
      'Product updated successfully'
  });
});

// Delete product (Dual system: soft delete from products page, hard delete from delete history)
export const deleteProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { permanent } = req.query; // ?permanent=true for hard delete

  const product = await Product.findById(id);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  if (permanent === 'true') {
    // PERMANENT DELETE (from Delete History page)
    await Product.findByIdAndDelete(id);
    await Inventory.findOneAndDelete({ product: id });
    
    console.log(`🗑️ PERMANENTLY DELETED product: ${product.name} (ID: ${id})`);

    // Clear all caches for immediate updates
    try {
      const { productionCache } = await import('../utils/productionOptimization');
      await productionCache.clearAllProductCache();
      console.log('🧹 Cache cleared after permanent product deletion');
    } catch (error) {
      console.log('⚠️ Cache clear failed:', error);
    }

    res.json({
      success: true,
      message: 'Product permanently deleted successfully',
      data: { 
        productId: id, 
        deletedPermanently: true,
        action: 'hard_delete',
        location: 'delete_history'
      }
    });
  } else {
    // SOFT DELETE (from Products page - move to Delete History)
    await Product.findByIdAndUpdate(id, { 
      isActive: false,
      deletedAt: new Date() 
    });
    
    await Inventory.findOneAndUpdate(
      { product: id }, 
      { isActive: false, deletedAt: new Date() }
    );
    
    console.log(`📦 SOFT DELETED product (moved to Delete History): ${product.name} (ID: ${id})`);

    // Clear all caches for immediate updates
    try {
      const { productionCache } = await import('../utils/productionOptimization');
      await productionCache.clearAllProductCache();
      console.log('🧹 Cache cleared after soft product deletion');
    } catch (error) {
      console.log('⚠️ Cache clear failed:', error);
    }

    res.json({
      success: true,
      message: 'Product moved to Delete History successfully',
      data: { 
        productId: id, 
        deletedPermanently: false,
        action: 'soft_delete',
        location: 'delete_history'
      }
    });
  }
});

// Get featured products
export const getFeaturedProducts = asyncHandler(async (req: Request, res: Response) => {
  const { limit = 8 } = req.query;

  const products = await Product.find({ 
    isActive: true, 
    isFeatured: true 
  })
    .populate('category', 'name slug')
    .sort({ createdAt: -1 })
    .limit(Number(limit));

  // Get inventory data for featured products
  const productIds = products.map(p => p._id);
  const inventoryData = await Inventory.find({ 
    product: { $in: productIds },
    isActive: true 
  });

  // Merge inventory data with products
  const productsWithInventory = products.map(product => {
    const inventory = inventoryData.find(inv => 
      inv.product.toString() === product._id.toString()
    );
    
    return {
      ...product.toObject(),
      inventory: inventory ? {
        availableForSale: inventory.availableForSale,
        quantityAvailable: inventory.quantityAvailable,
        quantityReserved: inventory.quantityReserved,
        isOutOfStock: inventory.isOutOfStock,
        isLowStock: inventory.isLowStock,
        reorderLevel: inventory.reorderLevel
      } : {
        availableForSale: 0,
        quantityAvailable: 0,
        quantityReserved: 0,
        isOutOfStock: true,
        isLowStock: false,
        reorderLevel: 0
      }
    };
  });

  res.json({
    success: true,
    data: productsWithInventory
  });
});

// Get products by category
export const getProductsByCategory = asyncHandler(async (req: Request, res: Response) => {
  const { categoryId } = req.params;
  
  // Parse standardized query parameters
  const { page, size, sortBy, sortOrder, search } = parseStandardizedQuery(req.query);

  const category = await Category.findById(categoryId);
  if (!category) {
    throw new NotFoundError('Category not found');
  }

  // Build filter
  const filter: any = { category: categoryId, isActive: true };
  
  // Add search filter if provided
  if (search && search.trim()) {
    const searchFilter = buildSearchFilter(search, ['name', 'description', 'shortDescription', 'sku']);
    Object.assign(filter, searchFilter);
  }

  const totalElements = await Product.countDocuments(filter);
  const pagination = calculatePagination(page, size, totalElements);

  const sort = buildSortObject(sortBy, sortOrder);

  const products = await Product.find(filter)
    .populate('category', 'name slug')
    .sort(sort)
    .skip(pagination.skip)
    .limit(pagination.size);

  // Create standardized response
  const response = createStandardizedResponse(products, pagination);

  res.json({
    success: true,
    ...response,
    meta: {
      category
    }
  });
});

// Update product stock (Admin only)
export const updateProductStock = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { quantity } = req.body;

  // Validate input
  const stockSchema = z.object({
    quantity: z.number().min(0, 'Stock quantity cannot be negative')
  });

  const validatedData = stockSchema.parse({ quantity });

  const product = await Product.findById(id);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Update product stock
  product.stock.quantity = validatedData.quantity;
  product.stock.available = Math.max(0, validatedData.quantity - product.stock.reserved);
  product.inStock = product.stock.available > 0;
  
  await product.save();

  // Update inventory record using StockManager
  if (!id) {
    throw new ValidationError('Product ID is required');
  }
  const { StockManager } = await import('../utils/stockManager');
  await StockManager.ensureInventoryRecord(id);
  
  // Update inventory to sync with new product stock
  const inventory = await Inventory.findOne({ product: id });
  if (inventory) {
    inventory.quantityAvailable = product.stock.available;
    inventory.quantityReserved = product.stock.reserved;
    inventory.lastRestocked = new Date();
    await inventory.save();
  }

  // Return updated product with inventory
  const updatedProduct = await Product.findById(id).populate('category', 'name slug');
  const updatedInventory = await Inventory.findOne({ product: id });

  res.json({
    success: true,
    data: {
      product: updatedProduct,
      inventory: updatedInventory
    },
    message: `Stock updated to ${validatedData.quantity} units`
  });
});

// Get deleted products for Delete History page
export const getDeletedProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  // Get soft-deleted products (isActive: false)
  const deletedProducts = await Product.find({ 
    isActive: false,
    deletedAt: { $exists: true }
  })
    .populate('category', 'name')
    .sort({ deletedAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Product.countDocuments({ 
    isActive: false,
    deletedAt: { $exists: true }
  });

  console.log(`📋 FETCHED ${deletedProducts.length} deleted products for Delete History`);

  res.json({
    success: true,
    data: {
      products: deletedProducts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// Restore product from Delete History
export const restoreProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  if (product.isActive) {
    throw new BadRequestError('Product is already active');
  }

  // Restore product
  await Product.findByIdAndUpdate(id, { 
    isActive: true,
    $unset: { deletedAt: 1 }
  });
  
  await Inventory.findOneAndUpdate(
    { product: id }, 
    { 
      isActive: true,
      $unset: { deletedAt: 1 }
    }
  );
  
  console.log(`♻️ RESTORED product: ${product.name} (ID: ${id})`);

  res.json({
    success: true,
    message: 'Product restored successfully',
    data: { 
      productId: id, 
      restored: true 
    }
  });
});
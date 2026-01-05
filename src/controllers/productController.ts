import { Request, Response } from 'express';
import { z } from 'zod';
import { Product, Category, Inventory } from '../models';
import { 
  asyncHandler, 
  ValidationError, 
  NotFoundError 
} from '../middleware/errorMiddleware';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { calculatePagination, generateSlug, generateSKU } from '../utils/helpers.js';

// Validation schema for creating products
const createProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  shortDescription: z.string().min(10, 'Short description must be at least 10 characters').max(300),
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID'),
  images: z.array(z.object({
    url: z.string().url('Invalid image URL'),
    alt: z.string().min(1, 'Alt text is required'),
    isPrimary: z.boolean().default(false)
  })).min(1, 'At least one image is required'),
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
  // Inventory data
  initialStock: z.number().min(0, 'Initial stock cannot be negative').default(0),
  reorderLevel: z.number().min(0, 'Reorder level cannot be negative').default(10),
  maxStockLevel: z.number().min(1, 'Max stock level must be at least 1').default(1000)
});

// Validation schema for updating products
const updateProductSchema = createProductSchema.partial();

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
 *         name: limit
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
 *         description: Search query for product names
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
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalCount:
 *                       type: integer
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    search = '',
    category = '',
    minPrice = 0,
    maxPrice = 999999,
    featured,
    inStock
  } = req.query;

  // Build filter query
  const filter: any = { isActive: true };
  
  if (search) {
    filter.$text = { $search: search };
  }
  
  if (category) {
    filter.category = category;
  }
  
  if (featured === 'true') {
    filter.isFeatured = true;
  }
  
  filter['price.selling'] = { 
    $gte: Number(minPrice), 
    $lte: Number(maxPrice) 
  };

  // Count total documents
  const totalCount = await Product.countDocuments(filter);
  const pagination = calculatePagination(Number(page), Number(limit), totalCount);

  // Build sort object
  const sort: any = {};
  sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

  // Query products
  const products = await Product.find(filter)
    .populate('category', 'name slug')
    .sort(sort)
    .skip(pagination.skip)
    .limit(pagination.limit);

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

  // Apply stock filter if needed
  let filteredProducts = productsWithInventory;
  if (inStock === 'true') {
    filteredProducts = productsWithInventory.filter(product => 
      product.inventory.availableForSale > 0
    );
  }

  res.json({
    success: true,
    data: {
      products: filteredProducts,
      pagination: {
        ...pagination,
        totalCount: inStock === 'true' ? filteredProducts.length : totalCount
      }
    }
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
  const validatedData = createProductSchema.parse(req.body);

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

  // Create product
  const product = await Product.create(productOnlyData);

  // Create inventory record
  await Inventory.create({
    product: product._id,
    sku: product.sku,
    quantityAvailable: initialStock,
    reorderLevel,
    maxStockLevel,
    supplier: {
      name: 'Default Supplier',
      contact: 'supplier@example.com',
      leadTime: 7
    }
  });

  // Populate the created product
  const populatedProduct = await Product.findById(product._id)
    .populate('category', 'name slug');

  const inventory = await Inventory.findOne({ product: product._id });

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
  const validatedData = updateProductSchema.parse(req.body);

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

  // Update product
  const updatedProduct = await Product.findByIdAndUpdate(
    id,
    { ...updateData, category: validatedData.categoryId || updateData.categoryId },
    { new: true, runValidators: true }
  ).populate('category', 'name slug');

  res.json({
    success: true,
    data: updatedProduct
  });
});

// Delete product (Admin only)
export const deleteProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const product = await Product.findById(id);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  // Soft delete by setting isActive to false
  await Product.findByIdAndUpdate(id, { isActive: false });

  // Also deactivate inventory
  await Inventory.findOneAndUpdate(
    { product: id }, 
    { isActive: false }
  );

  res.json({
    success: true,
    message: 'Product deleted successfully'
  });
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
  const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const category = await Category.findById(categoryId);
  if (!category) {
    throw new NotFoundError('Category not found');
  }

  const filter = { category: categoryId, isActive: true };
  const totalCount = await Product.countDocuments(filter);
  const pagination = calculatePagination(Number(page), Number(limit), totalCount);

  const sort: any = {};
  sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

  const products = await Product.find(filter)
    .populate('category', 'name slug')
    .sort(sort)
    .skip(pagination.skip)
    .limit(pagination.limit);

  res.json({
    success: true,
    data: {
      products,
      pagination: {
        ...pagination,
        totalCount
      },
      category
    }
  });
});
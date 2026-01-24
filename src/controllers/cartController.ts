import { Response } from 'express';
import { z } from 'zod';
import { Cart, Product } from '../models';
import { 
  asyncHandler, 
  ValidationError, 
  NotFoundError
} from '../middleware/errorMiddleware';
import { CustomerAuthenticatedRequest } from '../middleware/customerAuthMiddleware';

// Validation schemas
const addToCartSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  quantity: z.number().min(1, 'Quantity must be at least 1').max(100, 'Maximum quantity is 100').optional().default(1),
  selectedSize: z.string().optional(),
  selectedColor: z.string().optional(),
  variants: z.record(z.string(), z.string()).optional()
});

const updateCartItemSchema = z.object({
  quantity: z.number().min(0, 'Quantity must be at least 0').max(100, 'Maximum quantity is 100')
});

/**
 * @swagger
 * /api/v1/cart:
 *   get:
 *     summary: Get customer's shopping cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 */
export const getCart = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  // Find or create cart for customer
  const cart = await Cart.findOrCreateCart(req.customer._id.toString());

  // Populate product details
  await cart.populate({
    path: 'items.product',
    select: 'name slug price images category sku isActive inStock stock',
    populate: {
      path: 'category',
      select: 'name slug'
    }
  });

  // Filter out items with inactive/deleted products
  const validItems = cart.items.filter((item: any) => {
    const product = item.product;
    return product && product.isActive && product.inStock;
  });

  // Remove invalid items from cart
  if (validItems.length !== cart.items.length) {
    cart.items = validItems;
    await cart.save();
  }

  // Format response
  const cartItems = cart.items.map((item: any) => {
    const product = item.product;
    return {
      id: item._id,
      product: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        images: product.images,
        category: product.category,
        sku: product.sku,
        inStock: product.inStock,
        availableStock: product.stock.available
      },
      quantity: item.quantity,
      selectedSize: item.selectedSize,
      selectedColor: item.selectedColor,
      variants: item.variants,
      itemTotal: item.price * item.quantity,
      addedAt: item.addedAt
    };
  });

  res.json({
    success: true,
    data: {
      items: cartItems,
      totals: cart.totals,
      lastActivity: cart.lastActivity
    }
  });
});

/**
 * @swagger
 * /api/v1/cart/add:
 *   post:
 *     summary: Add item to cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: number
 *                 default: 1
 */
export const addToCart = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const validatedData = addToCartSchema.parse(req.body);
  const { productId, quantity, selectedSize, selectedColor, variants } = validatedData;

  // Find product and validate
  const product = await Product.findById(productId);
  if (!product) {
    throw new NotFoundError('Product not found');
  }

  if (!product.isActive) {
    throw new ValidationError('Product is not available');
  }

  // Check stock availability with comprehensive logic
  const productAny = product as any; // Type assertion to access inventory field
  
  // Get available stock using a more reliable method
  let availableStock = 0;
  
  // Try inventory field first (for products created through admin)
  if (productAny.inventory?.availableForSale !== undefined) {
    availableStock = productAny.inventory.availableForSale;
  }
  // Try separate inventory collection
  else {
    const { Inventory } = await import('../models');
    const inventory = await Inventory.findOne({ product: product._id });
    if (inventory?.quantityAvailable !== undefined) {
      availableStock = inventory.quantityAvailable;
    }
    // Fallback to product stock fields
    else if (product.stock?.available !== undefined) {
      availableStock = product.stock.available;
    } else if (product.stock?.quantity !== undefined) {
      availableStock = Math.max(0, product.stock.quantity - (product.stock.reserved || 0));
    }
  }

  // Console log for debugging
  console.log('🔍 Stock Check Debug:', {
    productName: product.name,
    productId: product._id,
    inventoryAvailableForSale: productAny.inventory?.availableForSale,
    stockAvailable: product.stock?.available,
    stockQuantity: product.stock?.quantity,
    stockReserved: product.stock?.reserved,
    finalAvailableStock: availableStock,
    inStock: product.inStock,
    isActive: product.isActive,
    requestedQuantity: quantity
  });

  // Check if product is marked as out of stock
  if (!product.inStock && availableStock <= 0) {
    throw new ValidationError('Product is out of stock');
  }

  // Check if sufficient stock is available
  if (availableStock < quantity) {
    throw new ValidationError(`Only ${availableStock} items available in stock`);
  }

  // Find or create cart
  const cart = await Cart.findOrCreateCart(req.customer._id.toString());

  // Check if item already exists in cart (same product + variants)
  const existingItemIndex = cart.items.findIndex((item: any) => 
    item.product.toString() === productId &&
    item.selectedSize === selectedSize &&
    item.selectedColor === selectedColor &&
    JSON.stringify(item.variants || {}) === JSON.stringify(variants || {})
  );

  if (existingItemIndex > -1) {
    // Update existing item quantity
    const existingItem = cart.items[existingItemIndex];
    if (!existingItem) {
      throw new ValidationError('Cart item not found');
    }
    
    const newQuantity = existingItem.quantity + quantity;
    
    // Check stock for new total quantity
    if (product.stock.available < newQuantity) {
      throw new ValidationError(`Only ${product.stock.available} items available. You have ${existingItem.quantity} in cart.`);
    }

    existingItem.quantity = newQuantity;
    existingItem.updatedAt = new Date();
  } else {
    // Add new item to cart
    cart.items.push({
      product: product._id,
      name: product.name,
      sku: product.sku,
      price: product.price.selling,
      quantity,
      selectedSize,
      selectedColor,
      variants: variants || {},
      addedAt: new Date(),
      updatedAt: new Date()
    } as any);
  }

  await cart.save();

  // Reserve stock temporarily (optional - can be done at checkout)
  // await product.reserveStock(quantity);

  res.status(201).json({
    success: true,
    message: 'Item added to cart successfully',
    data: {
      cartItemsCount: cart.totals.totalItems,
      cartTotal: cart.totals.total
    }
  });
});

/**
 * @swagger
 * /api/v1/cart/item/{itemId}:
 *   put:
 *     summary: Update cart item quantity
 */
export const updateCartItem = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const { itemId } = req.params;
  const validatedData = updateCartItemSchema.parse(req.body);
  const { quantity } = validatedData;

  // Find cart
  const cart = await Cart.findOne({ customer: req.customer._id });
  if (!cart) {
    throw new NotFoundError('Cart not found');
  }

  // Find cart item
  const itemIndex = cart.items.findIndex((item: any) => item._id.toString() === itemId);
  if (itemIndex === -1) {
    throw new NotFoundError('Item not found in cart');
  }

  const cartItem = cart.items[itemIndex];
  if (!cartItem) {
    throw new NotFoundError('Cart item not found');
  }

  if (quantity === 0) {
    // Remove item from cart
    cart.items.splice(itemIndex, 1);
  } else {
    // Validate stock availability
    const product = await Product.findById(cartItem.product);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Import Inventory model to check actual available stock
    const { Inventory } = await import('../models/index.js');
    const inventoryData = await Inventory.findOne({ product: cartItem.product });
    
    // Use inventory data as primary source, fall back to product stock
    // Handle both old and new inventory field structures
    const inventoryStock = inventoryData?.availableForSale || inventoryData?.quantityAvailable || 0;
    const availableStock = inventoryStock || product.stock?.available || 0;
    
    console.log('🔍 Stock validation for cart update:', {
      productId: product._id.toString(),
      productName: product.name,
      requestedQuantity: quantity,
      stockAvailable: product.stock?.available || 0,
      inventoryAvailableForSale: inventoryData?.availableForSale || 0,
      inventoryQuantityAvailable: inventoryData?.quantityAvailable || 0,
      finalAvailableStock: availableStock,
      hasInventory: !!inventoryData,
      hasStock: !!product.stock
    });

    if (availableStock < quantity) {
      throw new ValidationError(`Only ${availableStock} items available in stock`);
    }

    // Update quantity
    const updateItem = cart.items[itemIndex];
    if (updateItem) {
      updateItem.quantity = quantity;
      updateItem.updatedAt = new Date();
    }
  }

  await cart.save();

  res.json({
    success: true,
    message: quantity === 0 ? 'Item removed from cart' : 'Cart item updated successfully',
    data: {
      cartItemsCount: cart.totals.totalItems,
      cartTotal: cart.totals.total
    }
  });
});

/**
 * @swagger
 * /api/v1/cart/item/{itemId}:
 *   delete:
 *     summary: Remove item from cart
 */
export const removeCartItem = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const { itemId } = req.params;

  // Find cart
  const cart = await Cart.findOne({ customer: req.customer._id });
  if (!cart) {
    throw new NotFoundError('Cart not found');
  }

  // Remove item
  const initialLength = cart.items.length;
  cart.items = cart.items.filter((item: any) => item._id.toString() !== itemId);

  if (cart.items.length === initialLength) {
    throw new NotFoundError('Item not found in cart');
  }

  await cart.save();

  res.json({
    success: true,
    message: 'Item removed from cart successfully',
    data: {
      cartItemsCount: cart.totals.totalItems,
      cartTotal: cart.totals.total
    }
  });
});

/**
 * @swagger
 * /api/v1/cart/clear:
 *   delete:
 *     summary: Clear entire cart
 */
export const clearCart = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  // Find cart
  const cart = await Cart.findOne({ customer: req.customer._id });
  if (!cart) {
    throw new NotFoundError('Cart not found');
  }

  // Clear cart
  cart.items = [];
  await cart.save();

  res.json({
    success: true,
    message: 'Cart cleared successfully',
    data: {
      cartItemsCount: 0,
      cartTotal: 0
    }
  });
});

/**
 * @swagger
 * /api/v1/cart/validate:
 *   post:
 *     summary: Validate cart before checkout
 */
export const validateCart = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  // Find cart with product details
  const cart = await Cart.findOne({ customer: req.customer._id }).populate({
    path: 'items.product',
    select: 'name price isActive inStock stock'
  });

  if (!cart || cart.items.length === 0) {
    throw new ValidationError('Cart is empty');
  }

  const validationErrors: string[] = [];
  const validItems = [];

  for (let i = 0; i < cart.items.length; i++) {
    const item = cart.items[i] as any;
    const product = item.product;

    if (!product) {
      validationErrors.push(`Product ${item.name} no longer exists`);
      continue;
    }

    if (!product.isActive) {
      validationErrors.push(`Product ${product.name} is no longer available`);
      continue;
    }

    if (!product.inStock) {
      validationErrors.push(`Product ${product.name} is out of stock`);
      continue;
    }

    if (product.stock.available < item.quantity) {
      validationErrors.push(`Product ${product.name}: Only ${product.stock.available} items available, but ${item.quantity} requested`);
      continue;
    }

    // Check for price changes
    if (Math.abs(item.price - product.price.selling) > 0.01) {
      validationErrors.push(`Price changed for ${product.name}: was ₹${item.price}, now ₹${product.price.selling}`);
      // Update cart with new price
      item.price = product.price.selling;
    }

    validItems.push(item);
  }

  // Update cart with valid items and new prices
  if (validItems.length !== cart.items.length) {
    cart.items = validItems;
    await cart.save();
  }

  const isValid = validationErrors.length === 0;

  res.json({
    success: true,
    data: {
      isValid,
      errors: validationErrors,
      cartSummary: {
        totalItems: cart.totals.totalItems,
        total: cart.totals.total,
        subtotal: cart.totals.subtotal,
        tax: cart.totals.tax,
        shipping: cart.totals.shipping
      }
    }
  });
});

/**
 * @swagger
 * /api/v1/cart/count:
 *   get:
 *     summary: Get cart items count
 */
export const getCartCount = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const cart = await Cart.findOne({ customer: req.customer._id });
  
  res.json({
    success: true,
    data: {
      count: cart ? cart.totals.totalItems : 0
    }
  });
});
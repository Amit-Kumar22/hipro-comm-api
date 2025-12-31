import { Request, Response } from 'express';
import { z } from 'zod';
import { Customer, Product } from '../models';
import { 
  asyncHandler, 
  ValidationError, 
  NotFoundError 
} from '../middleware/errorMiddleware';
import { CustomerAuthenticatedRequest } from '../middleware/customerAuthMiddleware';

// Validation schemas
const addToCartSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid product ID'),
  quantity: z.number().min(1, 'Quantity must be at least 1').max(100, 'Maximum quantity is 100'),
  selectedSize: z.string().optional(),
  selectedColor: z.string().optional()
});

const updateCartItemSchema = z.object({
  quantity: z.number().min(0, 'Quantity must be at least 0').max(100, 'Maximum quantity is 100')
});

const removeFromCartSchema = z.object({
  itemId: z.string().min(1, 'Item ID is required')
});

// Get customer's cart
export const getCart = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const customer = await Customer.findById(req.customer._id)
    .populate({
      path: 'cart.product',
      select: 'name slug price images category sku inStock',
      populate: {
        path: 'category',
        select: 'name slug'
      }
    });

  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  // Calculate cart totals
  let totalItems = 0;
  let totalPrice = 0;

  const cartItems = customer.cart.map((item: any) => {
    const product = item.product as any;
    const itemTotal = product.price.selling * item.quantity;
    totalItems += item.quantity;
    totalPrice += itemTotal;

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
        inStock: product.inStock
      },
      quantity: item.quantity,
      selectedSize: item.selectedSize,
      selectedColor: item.selectedColor,
      itemTotal
    };
  });

  res.json({
    success: true,
    data: {
      items: cartItems,
      totals: {
        totalItems,
        totalPrice,
        subtotal: totalPrice,
        tax: totalPrice * 0.18, // 18% GST
        shipping: totalPrice > 500 ? 0 : 50, // Free shipping above ₹500
        total: totalPrice + (totalPrice * 0.18) + (totalPrice > 500 ? 0 : 50)
      }
    }
  });
});

// Add item to cart
export const addToCart = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const validatedData = addToCartSchema.parse(req.body);

  // Check if product exists and is active
  const product = await Product.findById(validatedData.productId);
  if (!product || !product.isActive) {
    throw new NotFoundError('Product not found or inactive');
  }

  // Check if product is in stock
  if (!product.inStock) {
    throw new ValidationError('Product is out of stock');
  }

  const customer = await Customer.findById(req.customer._id);
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  // Create unique item identifier based on product and variants
  const itemIdentifier = `${validatedData.productId}-${validatedData.selectedSize || 'default'}-${validatedData.selectedColor || 'default'}`;

  // Check if item already exists in cart
  const existingItemIndex = customer.cart.findIndex((item: any) => {
    const existingItemIdentifier = `${item.product}-${item.selectedSize || 'default'}-${item.selectedColor || 'default'}`;
    return existingItemIdentifier === itemIdentifier;
  });

  if (existingItemIndex > -1) {
    // Update quantity of existing item
    const existingItem = customer.cart[existingItemIndex];
    (existingItem as any).quantity += validatedData.quantity;
  } else {
    // Add new item to cart
    (customer.cart as any).push({
      product: validatedData.productId,
      quantity: validatedData.quantity,
      selectedSize: validatedData.selectedSize,
      selectedColor: validatedData.selectedColor,
      addedAt: new Date()
    });
  }

  await customer.save();

  res.status(200).json({
    success: true,
    message: 'Product added to cart successfully',
    data: {
      cartItemsCount: customer.cart.length
    }
  });
});

// Update cart item quantity
export const updateCartItem = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const { itemId } = req.params;
  const { quantity } = updateCartItemSchema.parse(req.body);

  const customer = await Customer.findById(req.customer._id);
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  const itemIndex = customer.cart.findIndex((item: any) => item._id?.toString() === itemId);
  if (itemIndex === -1) {
    throw new NotFoundError('Cart item not found');
  }

  if (quantity === 0) {
    // Remove item if quantity is 0
    customer.cart.splice(itemIndex, 1);
  } else {
    // Update quantity
    (customer.cart[itemIndex] as any).quantity = quantity;
  }

  await customer.save();

  res.status(200).json({
    success: true,
    message: quantity === 0 ? 'Item removed from cart' : 'Cart item updated successfully',
    data: {
      cartItemsCount: customer.cart.length
    }
  });
});

// Remove item from cart
export const removeFromCart = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const { itemId } = req.params;

  const customer = await Customer.findById(req.customer._id);
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  const itemIndex = customer.cart.findIndex((item: any) => item._id?.toString() === itemId);
  if (itemIndex === -1) {
    throw new NotFoundError('Cart item not found');
  }

  customer.cart.splice(itemIndex, 1);
  await customer.save();

  res.status(200).json({
    success: true,
    message: 'Item removed from cart successfully',
    data: {
      cartItemsCount: customer.cart.length
    }
  });
});

// Clear entire cart
export const clearCart = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const customer = await Customer.findById(req.customer._id);
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  customer.cart = [];
  await customer.save();

  res.status(200).json({
    success: true,
    message: 'Cart cleared successfully',
    data: {
      cartItemsCount: 0
    }
  });
});

// Get cart items count
export const getCartItemsCount = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const customer = await Customer.findById(req.customer._id);
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  const totalItems = customer.cart.reduce((total: number, item: any) => total + item.quantity, 0);

  res.status(200).json({
    success: true,
    data: {
      totalItems,
      cartItemsCount: customer.cart.length
    }
  });
});
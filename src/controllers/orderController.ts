import { Response } from 'express';
import { z } from 'zod';
import { Cart, Order, Payment, Product } from '../models';
import { StockManager } from '../utils/stockManager';
import { 
  asyncHandler, 
  ValidationError, 
  NotFoundError,
  AppError 
} from '../middleware/errorMiddleware';
import { CustomerAuthenticatedRequest } from '../middleware/customerAuthMiddleware';
import {
  parseStandardizedQuery,
  buildSortObject,
  buildSearchFilter,
  createStandardizedResponse,
  calculatePagination
} from '../utils/helpers';

// Validation schemas
const createOrderSchema = z.object({
  shippingAddress: z.object({
    street: z.string().min(5, 'Street address must be at least 5 characters'),
    city: z.string().min(2, 'City name is required'),
    state: z.string().min(2, 'State name is required'),
    pincode: z.string().regex(/^\d{6}$/, 'Please enter a valid 6-digit pincode'),
    country: z.string().optional().default('India'),
    phone: z.string().regex(/^\d{10}$/, 'Please enter a valid 10-digit phone number')
  }),
  billingAddress: z.object({
    street: z.string().min(5, 'Street address must be at least 5 characters'),
    city: z.string().min(2, 'City name is required'),
    state: z.string().min(2, 'State name is required'),
    pincode: z.string().regex(/^\d{6}$/, 'Please enter a valid 6-digit pincode'),
    country: z.string().optional().default('India'),
    phone: z.string().regex(/^\d{10}$/, 'Please enter a valid 10-digit phone number')
  }).optional(),
  paymentMethod: z.enum(['cod', 'online'], {
    required_error: 'Payment method is required',
    invalid_type_error: 'Invalid payment method'
  }),
  appliedCoupons: z.array(z.object({
    code: z.string(),
    discount: z.number().min(0)
  })).optional().default([])
});

const cancelOrderSchema = z.object({
  reason: z.string().min(10, 'Cancellation reason must be at least 10 characters').max(500, 'Reason too long')
});

/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     summary: Create a new order from cart
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - shippingAddress
 *               - paymentMethod
 */
export const createOrder = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const validatedData = createOrderSchema.parse(req.body);
  const { shippingAddress, billingAddress, paymentMethod, appliedCoupons } = validatedData;

  try {
    // Get customer cart
    const cart = await Cart.findOne({ customer: req.customer._id }).populate({
      path: 'items.product',
      select: 'name sku price stock isActive inStock'
    });

    if (!cart || cart.items.length === 0) {
      throw new ValidationError('Cart is empty');
    }

    // Validate cart items and stock
    const orderItems = [];
    for (const cartItem of cart.items) {
      const product = cartItem.product as any;
      
      if (!product || !product.isActive || !product.inStock) {
        throw new ValidationError(`Product ${cartItem.name} is no longer available`);
      }

      if (product.stock.available < cartItem.quantity) {
        throw new ValidationError(
          `Insufficient stock for ${product.name}. Available: ${product.stock.available}, Requested: ${cartItem.quantity}`
        );
      }

      orderItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        quantity: cartItem.quantity,
        price: cartItem.price,
        variants: cartItem.variants || {},
        total: cartItem.price * cartItem.quantity
      });
    }

    // Calculate order totals
    const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
    let discount = 0;
    
    // Apply coupons (simplified - you can enhance this)
    for (const coupon of appliedCoupons) {
      discount += coupon.discount;
    }

    // Modified: No tax and shipping calculation - only real prices
    const tax = 0; // No GST calculation
    const shipping = 0; // No shipping cost
    const total = Math.round((subtotal - discount) * 100) / 100; // Only product prices

    // Generate order number
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.getTime().toString().slice(-4);
    const orderNumber = `ORD-${dateStr}-${timeStr}`;

    // Create order
    const order = new Order({
      orderNumber,
      user: req.customer._id,
      items: orderItems,
      totals: {
        subtotal,
        discount,
        tax,
        shipping,
        total
      },
      appliedCoupons,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      status: 'PENDING',
      paymentStatus: paymentMethod === 'cod' ? 'PENDING' : 'PENDING',
      paymentMethod,
      statusHistory: [{
        status: 'PENDING',
        timestamp: new Date()
      }]
    });

    // Reserve stock for all items using StockManager
    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product || !product.isActive || !product.inStock) {
        throw new ValidationError(`Product ${item.name} is no longer available`);
      }

      if (product.stock.available < item.quantity) {
        throw new ValidationError(
          `Insufficient stock for ${product.name}. Available: ${product.stock.available}, Requested: ${item.quantity}`
        );
      }

      // Use StockManager to reserve stock and update inventory
      const reserved = await StockManager.reserveStock(item.product.toString(), item.quantity);
      if (!reserved) {
        throw new ValidationError(`Failed to reserve stock for ${item.name}`);
      }
    }

    await order.save();

    // For COD orders, we keep stock reserved until delivery
    // For online orders, we keep stock reserved until payment is confirmed
    // Stock will be confirmed (reduced) when payment is processed or on delivery for COD

    // Create payment record
    const payment = new Payment({
      paymentId: `PAY${Date.now().toString().slice(-8)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      order: order._id,
      customer: req.customer._id,
      amount: total,
      currency: 'INR',
      method: paymentMethod === 'cod' ? 'COD' : 'CARD',
      status: paymentMethod === 'cod' ? 'PENDING' : 'INITIATED',
      gateway: {
        provider: 'RAZORPAY'
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        timestamp: new Date()
      }
    });

    await payment.save();

    // Link payment to order
    order.paymentId = payment._id;
    await order.save();

    // Don't clear cart immediately - only clear after successful payment
    // This allows users to retry payment if needed
    console.log('📦 Order created successfully, cart preserved for payment retry:', {
      orderId: order._id,
      cartItems: cart.items.length
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        total: order.totals.total,
        paymentId: payment.paymentId,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod
      }
    });

  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: Get customer's orders
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: Get customer orders with pagination and filters
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of orders per page
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
 *         description: Search orders by order number
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by order status
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *         description: Filter by payment status
 */
export const getOrders = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  // Parse standardized query parameters
  const { page, size, sortBy, sortOrder, search } = parseStandardizedQuery(req.query);
  
  // Extract order-specific filters
  const { status, paymentStatus } = req.query;

  // Build filter
  const filter: any = { user: req.customer._id };
  
  // Status filter
  if (status) {
    filter.status = status;
  }
  
  // Payment status filter
  if (paymentStatus) {
    filter.paymentStatus = paymentStatus;
  }
  
  // Search filter (by order number)
  if (search && search.trim()) {
    filter.orderNumber = { $regex: search.trim(), $options: 'i' };
  }

  // Count total elements
  const totalElements = await Order.countDocuments(filter);
  const pagination = calculatePagination(page, size, totalElements);

  // Build sort object
  const sort = buildSortObject(sortBy, sortOrder);

  // Query orders with pagination
  const orders = await Order.find(filter)
    .populate({
      path: 'items.product',
      select: 'name slug images'
    })
    .sort(sort)
    .skip(pagination.skip)
    .limit(pagination.size);

  // Format orders for response
  const formattedOrders = orders.map(order => ({
    _id: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    totals: order.totals,
    shippingAddress: order.shippingAddress,
    billingAddress: order.billingAddress,
    itemsCount: order.items.length,
    totalItems: order.items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: order.createdAt,
    canCancel: order.canBeCancelled(),
    items: order.items.map(item => ({
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
      product: (item.product as any) ? {
        _id: (item.product as any)._id,
        name: (item.product as any).name,
        slug: (item.product as any).slug,
        images: (item.product as any).images
      } : null
    }))
  }));

  // Create standardized response
  const response = createStandardizedResponse(formattedOrders, pagination);

  res.json({
    success: true,
    ...response
  });
});

/**
 * @swagger
 * /api/v1/orders/{orderId}:
 *   get:
 *     summary: Get order details
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
export const getOrderById = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const { orderId } = req.params;

  const order = await Order.findOne({ _id: orderId, user: req.customer._id })
    .populate({
      path: 'items.product',
      select: 'name slug images category'
    })
    .populate({
      path: 'paymentId',
      select: 'paymentId method status gateway refund'
    });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  res.json({
    success: true,
    data: {
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      items: order.items,
      totals: order.totals,
      appliedCoupons: order.appliedCoupons,
      shippingAddress: order.shippingAddress,
      billingAddress: order.billingAddress,
      statusHistory: order.statusHistory,
      tracking: order.tracking,
      notes: order.notes,
      cancelledAt: order.cancelledAt,
      cancellationReason: order.cancellationReason,
      createdAt: order.createdAt,
      canCancel: order.canBeCancelled(),
      payment: order.paymentId
    }
  });
});

/**
 * @swagger
 * /api/v1/orders/{orderId}/cancel:
 *   post:
 *     summary: Cancel an order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
export const cancelOrder = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const { orderId } = req.params;
  const validatedData = cancelOrderSchema.parse(req.body);
  const { reason } = validatedData;

  const order = await Order.findOne({ _id: orderId, user: req.customer._id });
  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (!order.canBeCancelled()) {
    throw new ValidationError(`Order cannot be cancelled. Current status: ${order.status}`);
  }

  // Cancel the order (this will handle stock release and refund)
  const cancelled = await order.cancelOrder(reason, req.customer._id.toString());
  
  if (!cancelled) {
    throw new AppError('Failed to cancel order', 500);
  }

  res.json({
    success: true,
    message: 'Order cancelled successfully',
    data: {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      cancelledAt: order.cancelledAt,
      cancellationReason: order.cancellationReason
    }
  });
});

/**
 * @swagger
 * /api/v1/orders/{orderId}/status:
 *   put:
 *     summary: Update order status (Admin only - but including for completeness)
 */
export const updateOrderStatus = asyncHandler(async (_req: CustomerAuthenticatedRequest, _res: Response) => {
  // This would typically be admin-only, but including for completeness
  throw new ValidationError('This endpoint is for admin use only');
});

/**
 * @swagger
 * /api/v1/orders/stats:
 *   get:
 *     summary: Get customer's order statistics
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
export const getOrderStats = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const customerId = req.customer._id;

  // Get all orders for the customer
  const orders = await Order.find({ user: customerId });

  // Calculate statistics
  const totalOrders = orders.length;
  const totalSpent = orders.reduce((sum, order) => sum + (order.totals?.total || 0), 0);

  // Status breakdown
  const statusBreakdown = orders.reduce((acc: any, order) => {
    const status = order.status;
    if (!acc[status]) {
      acc[status] = { count: 0, amount: 0 };
    }
    acc[status].count++;
    acc[status].amount += (order.totals?.total || 0);
    return acc;
  }, {});

  // Recent orders (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentOrders = orders.filter(order => 
    new Date(order.createdAt) >= thirtyDaysAgo
  );

  res.json({
    success: true,
    data: {
      totalOrders,
      totalSpent,
      statusBreakdown,
      recentOrdersCount: recentOrders.length,
      averageOrderValue: totalOrders > 0 ? totalSpent / totalOrders : 0,
      lastOrderDate: orders.length > 0 ? orders[orders.length - 1]?.createdAt : null
    }
  });
});
import { Response } from 'express';
import mongoose from 'mongoose';
import { Customer } from '../models/Customer.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { CustomerAuthenticatedRequest } from '../middleware/customerAuthMiddleware.js';
import { AppError } from '../middleware/errorMiddleware.js';

/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     summary: Place a new order
 *     tags: [Orders]
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
 *               - shippingAddress
 *               - paymentMethod
 *             properties:
 *               shippingAddress:
 *                 type: object
 *                 required:
 *                   - street
 *                   - city
 *                   - state
 *                   - zipCode
 *                 properties:
 *                   street:
 *                     type: string
 *                     example: "123 Main Street"
 *                   city:
 *                     type: string
 *                     example: "New Delhi"
 *                   state:
 *                     type: string
 *                     example: "Delhi"
 *                   zipCode:
 *                     type: string
 *                     example: "110001"
 *                   country:
 *                     type: string
 *                     default: "India"
 *               billingAddress:
 *                 type: object
 *                 description: "If not provided, shipping address will be used"
 *               paymentMethod:
 *                 type: string
 *                 enum: [card, upi, cod, wallet]
 *                 example: "card"
 *     responses:
 *       201:
 *         description: Order placed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Order placed successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         description: Invalid order data or empty cart
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Customer not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const placeOrder = async (req: CustomerAuthenticatedRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { shippingAddress, billingAddress, paymentMethod } = req.body;

    if (!shippingAddress) {
      throw new AppError('Shipping address is required', 400);
    }

    // Find customer with cart items
    const customer = await Customer.findById(req.customer?._id)
      .populate('cart.product')
      .session(session);

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    if (!customer.cart || customer.cart.length === 0) {
      throw new AppError('Cart is empty', 400);
    }

    // Validate cart items and check stock availability
    const orderItems = [];
    let subtotal = 0;

    for (const cartItem of customer.cart) {
      const product = cartItem.product as any;
      
      if (!product || !product.isActive) {
        throw new AppError(`Product ${product?.name || 'Unknown'} is no longer available`, 400);
      }

      // Check stock availability
      if (product.stock.available < cartItem.quantity) {
        throw new AppError(
          `Insufficient stock for ${product.name}. Available: ${product.stock.available}`,
          400
        );
      }

      // Reserve stock
      const stockReserved = await product.reserveStock(cartItem.quantity);
      if (!stockReserved) {
        throw new AppError(`Failed to reserve stock for ${product.name}`, 400);
      }

      const itemTotal = product.price.selling * cartItem.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        sku: product.sku,
        price: product.price.selling,
        quantity: cartItem.quantity,
        selectedSize: cartItem.selectedSize,
        selectedColor: cartItem.selectedColor,
        total: itemTotal
      });
    }

    // Calculate totals
    const tax = Math.round(subtotal * 0.18); // 18% GST
    const shipping = subtotal >= 500 ? 0 : 50; // Free shipping above ₹500
    const total = subtotal + tax + shipping;

    // Create order
    const order = new Order({
      user: customer._id,
      items: orderItems,
      totals: {
        subtotal,
        tax,
        shipping,
        discount: 0,
        total
      },
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      paymentMethod: paymentMethod || 'online',
      status: 'PENDING',
      paymentStatus: 'PENDING'
    });

    // Generate order number
    order.orderNumber = `ORD-${Date.now().toString().slice(-8)}-${Math.random().toString().slice(2, 6)}`;
    
    await order.save({ session });

    // Create payment record
    const payment = new Payment({
      order: order._id,
      customer: customer._id,
      amount: total,
      method: paymentMethod === 'cod' ? 'COD' : 'CARD',
      status: paymentMethod === 'cod' ? 'PENDING' : 'INITIATED',
      gateway: {
        provider: 'RAZORPAY',
        gatewayOrderId: `order_${Date.now()}`
      },
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        timestamp: new Date()
      }
    });

    await payment.save({ session });

    // Link payment to order
    order.paymentId = payment._id;
    await order.save({ session });

    // Clear customer cart
    customer.cart = [];
    await customer.save({ session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          total: order.totals.total,
          status: order.status,
          paymentStatus: order.paymentStatus
        },
        payment: {
          _id: payment._id,
          paymentId: payment.paymentId,
          amount: payment.amount,
          method: payment.method,
          status: payment.status
        }
      }
    });

  } catch (error: any) {
    await session.abortTransaction();
    throw new AppError(error.message || 'Failed to place order', error.statusCode || 500);
  } finally {
    session.endSession();
  }
};

// Get customer orders
export const getOrders = async (req: CustomerAuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user: req.customer?._id })
      .populate('items.product', 'name images slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments({ user: req.customer?._id });

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalOrders / limit),
          totalOrders,
          hasNext: page < Math.ceil(totalOrders / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error: any) {
    throw new AppError(error.message || 'Failed to fetch orders', error.statusCode || 500);
  }
};

// Get order by ID
export const getOrderById = async (req: CustomerAuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({
      _id: orderId,
      user: req.customer?._id
    }).populate('items.product', 'name images slug sku');

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error: any) {
    throw new AppError(error.message || 'Failed to fetch order', error.statusCode || 500);
  }
};

// Cancel order
export const cancelOrder = async (req: CustomerAuthenticatedRequest, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    // Find order
    const order = await Order.findOne({
      _id: orderId,
      user: req.customer?._id
    }).session(session);

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Check if order can be cancelled
    if (!['PENDING', 'PAID'].includes(order.status)) {
      throw new AppError('Order cannot be cancelled at this stage', 400);
    }

    // Restore stock for all items
    for (const item of order.items) {
      const product = await Product.findById(item.product).session(session);
      if (product) {
        await product.releaseStock(item.quantity);
      }
    }

    // Update order status
    order.status = 'CANCELLED';
    order.cancelledAt = new Date();
    order.cancellationReason = reason || 'Cancelled by customer';

    // Add to status history
    order.statusHistory.push({
      status: 'CANCELLED',
      timestamp: new Date(),
      note: reason || 'Cancelled by customer'
    });

    await order.save({ session });

    // Process refund if payment was made
    if (order.paymentStatus === 'PAID' && order.paymentId) {
      const payment = await Payment.findById(order.paymentId).session(session);
      if (payment) {
        const refundProcessed = await payment.processRefund(
          payment.amount,
          reason || 'Order cancelled by customer'
        );
        
        if (refundProcessed) {
          order.paymentStatus = 'REFUNDED';
          await order.save({ session });
        }
      }
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          cancelledAt: order.cancelledAt,
          cancellationReason: order.cancellationReason
        }
      }
    });

  } catch (error: any) {
    await session.abortTransaction();
    throw new AppError(error.message || 'Failed to cancel order', error.statusCode || 500);
  } finally {
    session.endSession();
  }
};

// Get order statistics
export const getOrderStats = async (req: CustomerAuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.customer?._id;

    const stats = await Order.aggregate([
      { $match: { user: customerId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totals.total' }
        }
      }
    ]);

    const totalOrders = await Order.countDocuments({ user: customerId });
    const totalSpent = await Order.aggregate([
      { $match: { user: customerId, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, total: { $sum: '$totals.total' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        totalSpent: totalSpent[0]?.total || 0,
        statusBreakdown: stats.reduce((acc, stat) => {
          acc[stat._id] = {
            count: stat.count,
            totalAmount: stat.totalAmount
          };
          return acc;
        }, {})
      }
    });
  } catch (error: any) {
    throw new AppError(error.message || 'Failed to fetch order statistics', error.statusCode || 500);
  }
};
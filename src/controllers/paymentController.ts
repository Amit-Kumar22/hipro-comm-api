import { Response } from 'express';
import { z } from 'zod';
import { Payment, Order } from '../models';
import { 
  asyncHandler, 
  ValidationError, 
  NotFoundError,
  AppError 
} from '../middleware/errorMiddleware';
import { CustomerAuthenticatedRequest } from '../middleware/customerAuthMiddleware';

// Validation schemas
const initiatePaymentSchema = z.object({
  orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid order ID'),
  paymentMethod: z.enum(['CARD', 'UPI', 'NET_BANKING', 'WALLET'], {
    required_error: 'Payment method is required'
  })
});

const verifyPaymentSchema = z.object({
  paymentId: z.string(),
  orderId: z.string(),
  signature: z.string().optional(),
  gatewayPaymentId: z.string().optional(),
  gatewayOrderId: z.string().optional()
});

const processRefundSchema = z.object({
  paymentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid payment ID'),
  amount: z.number().min(0.01, 'Refund amount must be greater than 0'),
  reason: z.string().min(5, 'Refund reason must be at least 5 characters').max(500, 'Reason too long')
});

/**
 * @swagger
 * /api/v1/payments/initiate:
 *   post:
 *     summary: Initiate payment for an order
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - paymentMethod
 */
export const initiatePayment = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const validatedData = initiatePaymentSchema.parse(req.body);
  const { orderId, paymentMethod } = validatedData;

  // Find the order
  const order = await Order.findOne({ _id: orderId, user: req.customer._id });
  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (order.status !== 'PENDING') {
    throw new ValidationError('Payment can only be initiated for pending orders');
  }

  if (order.paymentStatus !== 'PENDING') {
    throw new ValidationError('Payment already processed or in progress');
  }

  // Find existing payment record
  let payment = await Payment.findById(order.paymentId);
  if (!payment) {
    throw new NotFoundError('Payment record not found');
  }

  // Update payment method if different
  if (payment.method !== paymentMethod) {
    payment.method = paymentMethod;
  }

  // Simulate payment gateway integration
  const gatewayOrderId = `gw_order_${Date.now()}`;
  
  // Update payment with gateway details
  payment.status = 'INITIATED';
  payment.gateway.gatewayOrderId = gatewayOrderId;
  payment.gateway.transactionId = `txn_${Date.now()}`;
  
  await payment.save();

  // In real implementation, you would integrate with actual payment gateway
  // For simulation, we'll return mock gateway response
  const mockGatewayResponse = {
    gateway_order_id: gatewayOrderId,
    key: 'rzp_test_mock_key',
    amount: payment.amount * 100, // Amount in paise for Razorpay
    currency: payment.currency,
    order_id: order.orderNumber,
    name: 'HiPro Commerce',
    description: `Payment for order ${order.orderNumber}`,
    prefill: {
      name: req.customer.name,
      email: req.customer.email,
      contact: req.customer.phone || ''
    },
    theme: {
      color: '#3399cc'
    }
  };

  res.json({
    success: true,
    message: 'Payment initiated successfully',
    data: {
      paymentId: payment._id,
      orderId: order._id,
      orderNumber: order.orderNumber,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      gateway: mockGatewayResponse
    }
  });
});

/**
 * @swagger
 * /api/v1/payments/verify:
 *   post:
 *     summary: Verify payment after gateway response
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 */
export const verifyPayment = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const validatedData = verifyPaymentSchema.parse(req.body);
  const { paymentId, orderId, signature, gatewayPaymentId } = validatedData;

  try {
    // Find payment and order
    const payment = await Payment.findOne({ 
      _id: paymentId, 
      customer: req.customer._id 
    });
    
    const order = await Order.findOne({ 
      _id: orderId, 
      user: req.customer._id 
    });

    if (!payment || !order) {
      throw new NotFoundError('Payment or order not found');
    }

    if (payment.status !== 'INITIATED') {
      throw new ValidationError('Invalid payment status for verification');
    }

    // In real implementation, verify signature with payment gateway
    // For simulation, we'll assume verification is successful
    const isSignatureValid = true; // Mock verification

    if (!isSignatureValid) {
      // Update payment as failed
      payment.status = 'FAILED';
      await payment.save();
      
      res.status(400).json({
        success: false,
        message: 'Payment verification failed',
        data: {
          paymentId: payment._id,
          status: 'FAILED'
        }
      });
      return;
    }

    // Payment successful - update records
    payment.status = 'SUCCESS';
    payment.gateway.gatewayPaymentId = gatewayPaymentId;
    payment.gateway.signature = signature;
    await payment.save();

    // Update order status
    order.status = 'PAID';
    order.paymentStatus = 'PAID';
    order.statusHistory.push({
      status: 'PAID',
      timestamp: new Date(),
      note: 'Payment verified successfully'
    });
    
    // Confirm sale for all order items (convert reserved stock to sold)
    const success = await order.confirmSale();
    if (!success) {
      throw new AppError('Failed to confirm stock sale', 500);
    }

    await order.save();

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        paymentId: payment._id,
        orderId: order._id,
        orderNumber: order.orderNumber,
        amount: payment.amount,
        status: payment.status,
        orderStatus: order.status,
        paidAt: payment.updatedAt
      }
    });

  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/v1/payments/history:
 *   get:
 *     summary: Get customer's payment history
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 */
export const getPaymentHistory = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status as string;

  const filter: any = { customer: req.customer._id };
  if (status) {
    filter.status = status;
  }

  const payments = await Payment.find(filter)
    .populate({
      path: 'order',
      select: 'orderNumber totals items createdAt'
    })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Payment.countDocuments(filter);

  const formattedPayments = payments.map(payment => ({
    _id: payment._id,
    paymentId: payment.paymentId,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    createdAt: payment.createdAt,
    order: payment.order ? {
      _id: (payment.order as any)._id,
      orderNumber: (payment.order as any).orderNumber,
      total: (payment.order as any).totals?.total,
      itemsCount: (payment.order as any).items?.length || 0,
      orderDate: (payment.order as any).createdAt
    } : null,
    refund: payment.refund ? {
      amount: payment.refund.amount,
      reason: payment.refund.reason,
      processedAt: payment.refund.processedAt,
      refundId: payment.refund.refundId
    } : null
  }));

  res.json({
    success: true,
    data: {
      payments: formattedPayments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

/**
 * @swagger
 * /api/v1/payments/{paymentId}:
 *   get:
 *     summary: Get payment details
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 */
export const getPaymentById = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const { paymentId } = req.params;

  const payment = await Payment.findOne({ 
    _id: paymentId, 
    customer: req.customer._id 
  }).populate({
    path: 'order',
    select: 'orderNumber totals items shippingAddress status'
  });

  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  res.json({
    success: true,
    data: {
      _id: payment._id,
      paymentId: payment.paymentId,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      gateway: {
        provider: payment.gateway.provider,
        transactionId: payment.gateway.transactionId,
        gatewayOrderId: payment.gateway.gatewayOrderId
      },
      metadata: payment.metadata,
      refund: payment.refund,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      order: payment.order
    }
  });
});

/**
 * @swagger
 * /api/v1/payments/refund:
 *   post:
 *     summary: Process refund (typically called internally)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 */
export const processRefund = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const validatedData = processRefundSchema.parse(req.body);
  const { paymentId, amount, reason } = validatedData;

  const payment = await Payment.findOne({ 
    _id: paymentId, 
    customer: req.customer._id 
  });

  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  if (!payment.canBeRefunded()) {
    throw new ValidationError('Payment cannot be refunded');
  }

  if (amount > payment.amount) {
    throw new ValidationError('Refund amount cannot exceed payment amount');
  }

  const refunded = await payment.processRefund(amount, reason);
  
  if (!refunded) {
    throw new AppError('Failed to process refund', 500);
  }

  res.json({
    success: true,
    message: 'Refund processed successfully',
    data: {
      paymentId: payment._id,
      originalAmount: payment.amount,
      refundAmount: amount,
      refundId: payment.refund?.refundId,
      status: payment.status,
      processedAt: payment.refund?.processedAt
    }
  });
});

/**
 * @swagger
 * /api/v1/payments/simulate/success:
 *   post:
 *     summary: Simulate successful payment (for testing)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 */
export const simulatePaymentSuccess = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const { paymentId, orderId } = req.body;

  const payment = await Payment.findOne({ 
    _id: paymentId, 
    customer: req.customer._id 
  });

  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  // Simulate successful payment
  payment.status = 'SUCCESS';
  payment.gateway.gatewayPaymentId = `pay_${Date.now()}`;
  payment.gateway.signature = `mock_signature_${Date.now()}`;
  await payment.save();

  // Update order
  const order = await Order.findById(orderId);
  if (order) {
    order.status = 'PAID';
    order.paymentStatus = 'PAID';
    order.statusHistory.push({
      status: 'PAID',
      timestamp: new Date(),
      note: 'Payment simulated as successful'
    });
    await order.save();
  }

  res.json({
    success: true,
    message: 'Payment simulated as successful',
    data: {
      paymentId: payment._id,
      status: payment.status,
      orderId,
      orderStatus: order?.status
    }
  });
});

/**
 * @swagger
 * /api/v1/payments/simulate/failure:
 *   post:
 *     summary: Simulate failed payment (for testing)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 */
export const simulatePaymentFailure = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const { paymentId } = req.body;

  const payment = await Payment.findOne({ 
    _id: paymentId, 
    customer: req.customer._id 
  });

  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  payment.status = 'FAILED';
  await payment.save();

  res.json({
    success: true,
    message: 'Payment marked as failed',
    data: {
      paymentId: payment._id,
      status: payment.status
    }
  });
});
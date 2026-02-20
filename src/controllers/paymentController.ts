import { Response } from 'express';
import { z } from 'zod';
import { Payment, Order, Image } from '../models';
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
    paymentId: paymentId, 
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
 * /api/v1/payments/{paymentId}/status:
 *   get:
 *     summary: Get payment status (lightweight for polling)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 */
export const getPaymentStatus = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const { paymentId } = req.params;
  console.log('Payment status check for:', { paymentId, customerId: req.customer._id });

  const payment = await Payment.findOne({ 
    _id: paymentId, 
    customer: req.customer._id 
  }).select('status gateway.transactionId updatedAt paymentId');

  if (!payment) {
    console.log('Payment not found with _id:', paymentId);
    throw new NotFoundError('Payment not found');
  }

  console.log('Payment found:', { 
    id: payment._id, 
    paymentId: payment.paymentId, 
    status: payment.status 
  });

  res.json({
    success: true,
    data: {
      paymentId: payment.paymentId,
      status: payment.status,
      transactionId: payment.gateway?.transactionId,
      lastUpdated: payment.updatedAt
    }
  });
});

/**
 * @swagger
 * /api/v1/payments/verify-proof:
 *   post:
 *     summary: Verify payment with proof (screenshot/transaction ID)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 */
export const verifyPaymentProof = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new ValidationError('Customer not authenticated');
  }

  const { paymentId, orderId, amount, transactionId } = req.body;
  const paymentProof = req.file; // For file upload

  console.log('Payment proof verification request:', {
    paymentId,
    orderId,
    amount,
    transactionId,
    hasFile: !!paymentProof,
    customerId: req.customer._id
  });

  if (!paymentId || !orderId) {
    throw new ValidationError('Payment ID and Order ID are required');
  }

  if (!paymentProof && !transactionId) {
    throw new ValidationError('Please provide payment screenshot or transaction ID');
  }

  // Find the payment using _id field (MongoDB ObjectId)
  const payment = await Payment.findOne({ 
    _id: paymentId, 
    customer: req.customer._id 
  });

  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  // Find the order
  const order = await Order.findOne({
    _id: orderId,
    user: req.customer._id
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // Verify amount matches
  console.log('Payment amount verification:', {
    submittedAmount: amount,
    parsedAmount: parseFloat(amount),
    orderTotal: order.totals.total,
    orderTotals: order.totals,
    orderId: order._id
  });

  if (amount && parseFloat(amount) !== order.totals.total) {
    console.error('❌ Amount mismatch:', {
      submitted: parseFloat(amount),
      expected: order.totals.total,
      difference: Math.abs(parseFloat(amount) - order.totals.total)
    });
    throw new ValidationError(`Payment amount does not match order total. Submitted: ₹${amount}, Expected: ₹${order.totals.total}`);
  }

  // Update payment with proof data
  const proofData: any = {
    submittedAt: new Date(),
    customerSubmitted: true,
    status: 'UNDER_REVIEW'
  };

  if (transactionId) {
    proofData.transactionId = transactionId;
    // Simple transaction ID validation
    if (transactionId.length < 8) {
      throw new ValidationError('Please enter a valid transaction ID');
    }
  }

  if (paymentProof) {
    // Store payment proof screenshot in database
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://shop.hiprotech.org' 
      : (process.env.API_BASE_URL || 'http://localhost:5001');
    
    const image = await Image.create({
      name: paymentProof.originalname,
      alt: `Payment proof for order ${orderId}`,
      data: paymentProof.buffer,
      contentType: paymentProof.mimetype,
      size: paymentProof.size,
      entityType: 'payment',
      entityId: payment._id,
      isPrimary: true
    });
    
    // Store the database image URL instead of filesystem path
    proofData.screenshotUrl = `${baseUrl}/api/v1/images/${image._id}`;
    proofData.screenshotId = image._id;
  }

  // Update payment with proof
  // Auto-approve for development if transaction ID is provided
  const shouldAutoApprove = process.env.NODE_ENV === 'development' && transactionId && transactionId.length >= 8;
  
  if (shouldAutoApprove) {
    payment.status = 'SUCCESS';
    order.paymentStatus = 'PAID';
    order.status = 'PAID';
    
    order.statusHistory.push({
      status: 'PAID',
      timestamp: new Date(),
      note: `Payment verified automatically with transaction ID: ${transactionId}`
    });
    
    console.log('✅ Payment auto-approved for development:', {
      paymentId: payment._id,
      transactionId,
      amount: order.totals.total
    });
  } else {
    payment.status = 'PENDING'; // Keep as pending while under review
    order.paymentStatus = 'PENDING';
    
    order.statusHistory.push({
      status: 'PENDING',
      timestamp: new Date(),
      note: `Payment proof submitted${transactionId ? ` with transaction ID: ${transactionId}` : ''}. Verification in progress.`
    });
  }
  
  payment.gateway.transactionId = transactionId || payment.gateway.transactionId;
  // Store proof data in metadata (extend interface if needed)
  (payment.metadata as any).proofSubmitted = proofData;
  await payment.save();

  // Update order status  
  await order.save();

  // Clear cart if payment was approved
  if (shouldAutoApprove) {
    const { Cart } = await import('../models');
    await Cart.findOneAndUpdate(
      { customer: req.customer._id },
      { $set: { items: [] } }
    );
    console.log('🛒 Cart cleared after successful payment verification');
  }

  res.json({
    success: true,
    message: shouldAutoApprove 
      ? 'Payment verified and approved successfully!' 
      : 'Payment proof submitted successfully. We will verify and update your order status within 5-10 minutes.',
    data: {
      paymentId: payment._id,
      status: shouldAutoApprove ? 'SUCCESS' : 'PENDING',
      message: shouldAutoApprove ? 'Payment completed successfully' : 'Verification in progress'
    }
  });
});

/**
 * Admin function to approve payment after verification
 * This would be called by admin after manually verifying the screenshot/transaction
 */
export const adminApprovePayment = asyncHandler(async (req: any, res: Response) => {
  const { paymentId, approved } = req.body;

  if (!paymentId) {
    throw new ValidationError('Payment ID is required');
  }

  const payment = await Payment.findOne({ paymentId: paymentId });
  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  const order = await Order.findOne({ _id: payment.order });
  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (approved) {
    // Approve payment
    payment.status = 'SUCCESS';
    await payment.save();

    // Update order
    order.status = 'PAID';
    order.paymentStatus = 'PAID';
    order.statusHistory.push({
      status: 'PAID',
      timestamp: new Date(),
      note: 'Payment verified and approved by admin'
    });
    await order.save();

    res.json({
      success: true,
      message: 'Payment approved successfully',
      data: { paymentId, status: 'SUCCESS' }
    });
  } else {
    // Reject payment
    payment.status = 'FAILED';
    await payment.save();

    order.status = 'CANCELLED';
    order.paymentStatus = 'FAILED';
    order.statusHistory.push({
      status: 'CANCELLED',
      timestamp: new Date(),
      note: 'Payment rejected by admin - verification failed'
    });
    await order.save();

    res.json({
      success: true,
      message: 'Payment rejected',
      data: { paymentId, status: 'FAILED' }
    });
  }
});

/**
 * Admin function to verify payment proof and approve/reject with message
 */
export const adminVerifyPayment = asyncHandler(async (req: any, res: Response) => {
  const { paymentId, action, message } = req.body;

  if (!paymentId || !action) {
    throw new ValidationError('Payment ID and action are required');
  }

  if (!['approve', 'reject'].includes(action)) {
    throw new ValidationError('Action must be either "approve" or "reject"');
  }

  // Find payment by MongoDB ObjectId
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  // Find associated order
  const order = await Order.findById(payment.order).populate('user', 'name email');
  if (!order) {
    throw new NotFoundError('Order not found');
  }

  const adminMessage = message || (action === 'approve' 
    ? 'Payment verified and approved by admin' 
    : 'Payment verification failed');

  if (action === 'approve') {
    // Approve payment
    payment.status = 'SUCCESS';
    order.status = 'PAID';
    order.paymentStatus = 'PAID';
    
    order.statusHistory.push({
      status: 'PAID',
      timestamp: new Date(),
      note: adminMessage
    });

    // Clear customer's cart when payment is approved
    const { Cart } = await import('../models');
    await Cart.findOneAndUpdate(
      { customer: order.user },
      { $set: { items: [] } }
    );

    console.log('✅ Admin approved payment:', {
      paymentId: payment._id,
      orderId: order._id,
      amount: payment.amount,
      adminMessage
    });

    await payment.save();
    await order.save();

    res.json({
      success: true,
      message: 'Payment approved successfully',
      data: { 
        paymentId: payment._id, 
        status: 'SUCCESS',
        orderStatus: 'PAID',
        customerMessage: adminMessage
      }
    });

  } else {
    // Reject payment
    payment.status = 'FAILED';
    order.status = 'CANCELLED';
    order.paymentStatus = 'FAILED';
    
    order.statusHistory.push({
      status: 'CANCELLED',
      timestamp: new Date(),
      note: adminMessage
    });

    console.log('❌ Admin rejected payment:', {
      paymentId: payment._id,
      orderId: order._id,
      reason: adminMessage
    });

    await payment.save();
    await order.save();

    res.json({
      success: true,
      message: 'Payment rejected and order cancelled',
      data: { 
        paymentId: payment._id, 
        status: 'FAILED',
        orderStatus: 'CANCELLED',
        customerMessage: adminMessage
      }
    });
  }
});

/**
 * Get payment details with proof for admin verification
 */
export const getPaymentForVerification = asyncHandler(async (req: any, res: Response) => {
  const { paymentId } = req.params;

  if (!paymentId) {
    throw new ValidationError('Payment ID is required');
  }

  // Find payment by MongoDB ObjectId
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  // Find associated order with customer details
  const order = await Order.findById(payment.order)
    .populate('user', 'name email phone')
    .select('orderNumber totals items status paymentStatus statusHistory createdAt');

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  res.json({
    success: true,
    data: {
      payment: {
        _id: payment._id,
        paymentId: payment.paymentId,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        gateway: payment.gateway,
        metadata: payment.metadata,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      },
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        totals: order.totals,
        status: order.status,
        paymentStatus: order.paymentStatus,
        customer: order.user,
        createdAt: order.createdAt,
        statusHistory: order.statusHistory
      }
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
    
    // Confirm sale for all order items (convert reserved stock to sold)
    const success = await order.confirmSale();
    if (!success) {
      throw new AppError('Failed to confirm stock sale', 500);
    }
    
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
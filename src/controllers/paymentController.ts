import { Response } from 'express';
import { Payment } from '../models/Payment.js';
import { Order } from '../models/Order.js';
import { CustomerAuthenticatedRequest } from '../middleware/customerAuthMiddleware.js';
import { AppError } from '../middleware/errorMiddleware.js';

// Simulate payment processing
export const processPayment = async (req: CustomerAuthenticatedRequest, res: Response) => {
  try {
    const { paymentId, orderId, method } = req.body;

    if (!paymentId || !orderId) {
      throw new AppError('Payment ID and Order ID are required', 400);
    }

    // Find payment
    const payment = await Payment.findOne({
      paymentId,
      customer: req.customer?._id
    });

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    // Find associated order
    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Simulate payment processing based on method
    let paymentSuccess = false;
    
    if (method === 'COD') {
      // COD is always successful at order placement
      paymentSuccess = true;
      payment.status = 'PENDING'; // Will be marked as SUCCESS on delivery
    } else {
      // Simulate online payment (90% success rate)
      paymentSuccess = Math.random() > 0.1;
      
      if (paymentSuccess) {
        payment.status = 'SUCCESS';
        payment.gateway.transactionId = `txn_${Date.now()}`;
        payment.gateway.gatewayPaymentId = `pay_${Date.now()}`;
        payment.gateway.signature = 'simulated_signature_' + Math.random().toString(36);
      } else {
        payment.status = 'FAILED';
      }
    }

    await payment.save();

    // Update order status based on payment result
    if (paymentSuccess) {
      order.paymentStatus = method === 'COD' ? 'PENDING' : 'PAID';
      order.status = method === 'COD' ? 'PENDING' : 'PAID';
      
      // Add to status history
      order.statusHistory.push({
        status: order.status,
        timestamp: new Date(),
        note: method === 'COD' ? 'Order placed with COD' : 'Payment successful'
      });
    } else {
      order.paymentStatus = 'FAILED';
      order.status = 'CANCELLED'; // Auto-cancel failed payments
      
      order.statusHistory.push({
        status: 'CANCELLED',
        timestamp: new Date(),
        note: 'Payment failed - Order cancelled'
      });
    }

    await order.save();

    res.status(200).json({
      success: paymentSuccess,
      message: paymentSuccess ? 'Payment processed successfully' : 'Payment failed',
      data: {
        payment: {
          paymentId: payment.paymentId,
          status: payment.status,
          amount: payment.amount,
          method: payment.method
        },
        order: {
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus
        }
      }
    });

  } catch (error: any) {
    throw new AppError(error.message || 'Failed to process payment', error.statusCode || 500);
  }
};

// Get payment history
export const getPaymentHistory = async (req: CustomerAuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const payments = await Payment.find({ customer: req.customer?._id })
      .populate('order', 'orderNumber status items.name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPayments = await Payment.countDocuments({ customer: req.customer?._id });

    res.status(200).json({
      success: true,
      data: {
        payments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalPayments / limit),
          totalPayments,
          hasNext: page < Math.ceil(totalPayments / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error: any) {
    throw new AppError(error.message || 'Failed to fetch payment history', error.statusCode || 500);
  }
};

// Get payment by ID
export const getPaymentById = async (req: CustomerAuthenticatedRequest, res: Response) => {
  try {
    const { paymentId } = req.params;

    const payment = await Payment.findOne({
      _id: paymentId,
      customer: req.customer?._id
    }).populate('order', 'orderNumber status totals items');

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error: any) {
    throw new AppError(error.message || 'Failed to fetch payment', error.statusCode || 500);
  }
};

// Request refund
export const requestRefund = async (req: CustomerAuthenticatedRequest, res: Response) => {
  try {
    const { paymentId } = req.params;
    const { reason, amount } = req.body;

    if (!reason) {
      throw new AppError('Refund reason is required', 400);
    }

    const payment = await Payment.findOne({
      _id: paymentId,
      customer: req.customer?._id
    }).populate('order');

    if (!payment) {
      throw new AppError('Payment not found', 404);
    }

    if (!payment.canBeRefunded()) {
      throw new AppError('Payment cannot be refunded', 400);
    }

    const refundAmount = amount || payment.amount;
    
    if (refundAmount > payment.amount) {
      throw new AppError('Refund amount cannot exceed payment amount', 400);
    }

    // Process refund
    const refundProcessed = await payment.processRefund(refundAmount, reason);
    
    if (!refundProcessed) {
      throw new AppError('Failed to process refund', 500);
    }

    // Update associated order
    const order = payment.order as any;
    if (order) {
      order.paymentStatus = 'REFUNDED';
      if (order.status !== 'CANCELLED') {
        order.status = 'CANCELLED';
        order.statusHistory.push({
          status: 'CANCELLED',
          timestamp: new Date(),
          note: `Order cancelled - Refund processed: ${reason}`
        });
      }
      await order.save();
    }

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        payment: {
          paymentId: payment.paymentId,
          status: payment.status,
          refund: payment.refund
        }
      }
    });

  } catch (error: any) {
    throw new AppError(error.message || 'Failed to process refund', error.statusCode || 500);
  }
};

// Get payment statistics
export const getPaymentStats = async (req: CustomerAuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.customer?._id;

    const stats = await Payment.aggregate([
      { $match: { customer: customerId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const totalPayments = await Payment.countDocuments({ customer: customerId });
    const totalSpent = await Payment.aggregate([
      { $match: { customer: customerId, status: 'SUCCESS' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalRefunded = await Payment.aggregate([
      { $match: { customer: customerId, status: 'REFUNDED' } },
      { $group: { _id: null, total: { $sum: '$refund.amount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalPayments,
        totalSpent: totalSpent[0]?.total || 0,
        totalRefunded: totalRefunded[0]?.total || 0,
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
    throw new AppError(error.message || 'Failed to fetch payment statistics', error.statusCode || 500);
  }
};
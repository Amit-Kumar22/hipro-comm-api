import { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import PaymentVerification from '../models/PaymentVerification';
import { Order } from '../models/Order';
import { CustomerOptionalAuthRequest } from '../middleware/optionalCustomerAuth';

// Configure multer for payment screenshot uploads - store in memory for database storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// Validation schema for payment verification
const paymentVerificationSchema = z.object({
  transactionId: z.string().min(8, 'Transaction ID must be at least 8 characters'),
  amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: 'Valid amount is required'
  }),
  orderId: z.string().optional()
});

export const uploadPaymentProof = upload.single('screenshot');

export const verifyPayment = async (req: CustomerOptionalAuthRequest, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validation = paymentVerificationSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      });
      return;
    }

    const { transactionId, amount, orderId } = validation.data;

    // Check if screenshot was uploaded
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'Payment screenshot is required'
      });
      return;
    }

    // Here you would typically:
    // 1. Fetch the order details from database
    // 2. Verify the amount matches the order total
    // 3. Check if the transaction ID is valid and not already used
    // 4. Possibly use OCR or manual review to verify the screenshot
    // 5. Update the order status if verification passes

    // If orderId is provided, validate it exists and amount matches
    let orderTotal = 0;
    let orderExists = false;
    
    if (orderId && orderId.trim()) {
      // Try to fetch order from database
      const order = await Order.findOne({ orderId: orderId.trim() });
      if (order) {
        orderTotal = order.totals.total;
        orderExists = true;
      } else {
        // Order doesn't exist yet - this is okay for payment verification
        // We'll validate against the provided amount and create order later if needed
        orderTotal = parseFloat(amount);
        orderExists = false;
      }
    } else {
      // If no orderId provided, we'll just verify the payment details without order validation
      // This allows payment verification before order creation
      orderTotal = parseFloat(amount); // Use provided amount for validation
      orderExists = false;
    }

    const paidAmount = parseFloat(amount);
    
    // Check if amounts match (allowing for small floating point differences)
    const amountMatches = Math.abs(paidAmount - orderTotal) < 0.01;
    
    if (!amountMatches) {
      res.status(400).json({
        success: false,
        message: `Payment amount ₹${amount} does not match ${orderId ? 'order total' : 'expected amount'} ₹${orderTotal}`
      });
      return;
    }

    // Check if transaction ID already exists
    const existingVerification = await PaymentVerification.findOne({ transactionId });
    if (existingVerification) {
      res.status(400).json({
        success: false,
        message: 'Transaction ID already used'
      });
      return;
    }

    // Validate transaction ID format
    if (transactionId.length < 8) {
      res.status(400).json({
        success: false,
        message: 'Invalid transaction ID format (minimum 8 characters)'
      });
      return;
    }

    // Create payment verification record with screenshot in database
    const paymentVerification = new PaymentVerification({
      orderId: orderId || null,
      transactionId,
      amount: paidAmount,
      paymentMethod: req.body.paymentMethod || 'bank_transfer',
      screenshot: {
        data: req.file.buffer,
        contentType: req.file.mimetype,
        filename: req.file.originalname,
        size: req.file.size
      },
      customerInfo: req.customer ? {
        email: req.customer.email,
        name: req.customer.name,
        phone: req.customer.phone
      } : {
        email: req.body.customerEmail || null,
        name: req.body.customerName || null,
        phone: req.body.customerPhone || null
      },
      verificationStatus: 'pending', // Always pending for admin review
      verifiedAt: null,
      verifiedBy: null
    });

    await paymentVerification.save();

    // Do NOT update order status to paid automatically - wait for admin verification
    // This prevents fraud payments from being processed automatically
    
    res.json({
      success: true,
      message: 'Payment verification submitted successfully. Your payment is being reviewed by our team.',
      data: {
        verificationId: paymentVerification._id,
        transactionId: paymentVerification.transactionId,
        amount: paymentVerification.amount,
        status: paymentVerification.verificationStatus,
        submittedAt: paymentVerification.createdAt,
        message: 'Payment verification is pending admin approval. You will receive confirmation once verified.'
      }
    });

  } catch (error) {
    console.error('Payment verification error:', error);

    res.status(500).json({
      success: false,
      message: 'Internal server error during payment verification'
    });
  }
};

// Get payment verification status
export const getPaymentVerificationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;

    const verification = await PaymentVerification.findOne({ orderId }).sort({ createdAt: -1 });
    
    if (!verification) {
      res.status(404).json({
        success: false,
        message: 'No payment verification found for this order'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        verificationId: verification._id,
        orderId: verification.orderId,
        transactionId: verification.transactionId,
        amount: verification.amount,
        status: verification.verificationStatus,
        submittedAt: verification.createdAt,
        verifiedAt: verification.verifiedAt,
        rejectionReason: verification.rejectionReason
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment verification status',
      error: error.message
    });
  }
};

// Serve screenshot from database
export const getPaymentScreenshot = async (req: Request, res: Response): Promise<void> => {
  try {
    const { verificationId } = req.params;

    const verification = await PaymentVerification.findById(verificationId);
    
    if (!verification || !verification.screenshot) {
      res.status(404).json({
        success: false,
        message: 'Screenshot not found'
      });
      return;
    }

    // Set appropriate headers
    res.set({
      'Content-Type': verification.screenshot.contentType,
      'Content-Length': verification.screenshot.size.toString(),
      'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
    });

    // Send the image data
    res.send(verification.screenshot.data);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve screenshot',
      error: error.message
    });
  }
};
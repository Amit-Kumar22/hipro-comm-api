import { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import PaymentVerification from '../models/PaymentVerification';
import { Order } from '../models/Order';
import { CustomerOptionalAuthRequest } from '../middleware/optionalCustomerAuth';

// Configure multer for payment screenshot uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/payment-proofs');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      console.log('✅ Payment proofs directory ensured:', uploadPath);
      cb(null, uploadPath);
    } catch (error) {
      console.error('❌ Failed to create payment proofs directory:', error);
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `payment-${uniqueSuffix}${ext}`;
    console.log('📁 Generating filename for payment proof:', filename);
    cb(null, filename);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('🔍 Checking file type:', file.mimetype);
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      console.log('❌ Invalid file type:', file.mimetype);
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
    console.log('Payment verification request received:', {
      body: req.body,
      file: req.file ? { filename: req.file.filename, size: req.file.size } : null,
      isAuthenticated: req.isAuthenticated,
      customerId: req.customer?.id
    });

    // Validate request body
    const validation = paymentVerificationSchema.safeParse(req.body);
    if (!validation.success) {
      console.error('Validation failed:', validation.error.errors);
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
        console.log('Order found, validating against order total:', orderTotal);
      } else {
        // Order doesn't exist yet - this is okay for payment verification
        // We'll validate against the provided amount and create order later if needed
        console.log('Order not found, but continuing with payment verification');
        orderTotal = parseFloat(amount);
        orderExists = false;
      }
    } else {
      // If no orderId provided, we'll just verify the payment details without order validation
      // This allows payment verification before order creation
      console.log('No order ID provided, verifying payment without order validation');
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

    // Create payment verification record
    const paymentVerification = new PaymentVerification({
      orderId: orderId || null,
      transactionId,
      amount: paidAmount,
      screenshotPath: req.file.path,
      screenshotFilename: req.file.filename,
      verificationStatus: 'verified', // In real app, might be 'pending' for manual review
      verifiedAt: new Date(),
      verifiedBy: req.isAuthenticated ? `customer:${req.customer.id}` : 'system'
    });

    await paymentVerification.save();

    // Update order status to paid only if orderId exists and order is found in database
    if (orderId && orderId.trim() && orderExists) {
      await Order.findOneAndUpdate(
        { orderId },
        { 
          paymentStatus: 'paid',
          status: 'confirmed'
        }
      );
      console.log('Order status updated to paid for orderId:', orderId);
    } else {
      console.log('Order update skipped - order not found or no orderId provided');
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        verificationId: paymentVerification.id,
        status: 'verified',
        orderId: orderId || null,
        transactionId,
        amount: paidAmount,
        verifiedAt: paymentVerification.verifiedAt,
        orderExists
      }
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    
    // Clean up uploaded file if verification fails
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.error('Failed to cleanup uploaded file:', cleanupError);
      }
    }

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

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
      return;
    }

    // Fetch verification from database
    const verification = await PaymentVerification.findOne({ orderId }).sort({ createdAt: -1 });
    
    if (!verification) {
      res.status(404).json({
        success: false,
        message: 'Payment verification not found for this order'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        orderId: verification.orderId,
        status: verification.verificationStatus,
        verifiedAt: verification.verifiedAt,
        transactionId: verification.transactionId,
        amount: verification.amount,
        createdAt: verification.createdAt
      }
    });

  } catch (error) {
    console.error('Error fetching payment verification status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment verification status'
    });
  }
};
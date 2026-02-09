import { Request, Response } from 'express';
import PaymentVerification from '../models/PaymentVerification';
import { Order } from '../models/Order';

// Get all payment verifications (admin only)
export const getAllPaymentVerifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    
    // Build filter query
    const filter: any = {};
    if (status && ['pending', 'verified', 'rejected'].includes(status)) {
      filter.verificationStatus = status;
    }
    
    // Get total count for pagination
    const total = await PaymentVerification.countDocuments(filter);
    
    // Fetch verifications with pagination
    const verifications = await PaymentVerification
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Transform data to include base64 screenshots for admin panel
    const transformedVerifications = verifications.map(verification => ({
      ...verification,
      screenshotBase64: verification.screenshot ? 
        `data:${verification.screenshot.contentType};base64,${verification.screenshot.data.toString('base64')}` : 
        null,
      screenshot: undefined // Remove binary data to reduce response size
    }));

    res.status(200).json({
      success: true,
      data: transformedVerifications,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Error fetching payment verifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment verifications'
    });
  }
};

// Get single payment verification details
export const getPaymentVerificationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { verificationId } = req.params;
    
    const verification = await PaymentVerification.findById(verificationId);
    if (!verification) {
      res.status(404).json({
        success: false,
        message: 'Payment verification not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: verification
    });
  } catch (error) {
    console.error('Error fetching payment verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment verification'
    });
  }
};

// Approve payment verification
export const approvePaymentVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { verificationId } = req.params;
    const adminId = (req as any).admin?.id || 'admin'; // Get from auth middleware
    
    const verification = await PaymentVerification.findById(verificationId);
    if (!verification) {
      res.status(404).json({
        success: false,
        message: 'Payment verification not found'
      });
      return;
    }

    if (verification.verificationStatus !== 'pending') {
      res.status(400).json({
        success: false,
        message: `Cannot approve verification with status: ${verification.verificationStatus}`
      });
      return;
    }

    // Update verification status
    verification.verificationStatus = 'verified';
    verification.verifiedAt = new Date();
    verification.verifiedBy = `admin:${adminId}`;
    await verification.save();

    // Update related order status if orderId exists
    if (verification.orderId) {
      await Order.findOneAndUpdate(
        { orderId: verification.orderId },
        { 
          paymentStatus: 'paid',
          status: 'confirmed'
        }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Payment verification approved successfully',
      data: verification
    });
  } catch (error) {
    console.error('Error approving payment verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve payment verification'
    });
  }
};

// Reject payment verification
export const rejectPaymentVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { verificationId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = (req as any).admin?.id || 'admin'; // Get from auth middleware
    
    if (!rejectionReason || typeof rejectionReason !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
      return;
    }

    const verification = await PaymentVerification.findById(verificationId);
    if (!verification) {
      res.status(404).json({
        success: false,
        message: 'Payment verification not found'
      });
      return;
    }

    if (verification.verificationStatus !== 'pending') {
      res.status(400).json({
        success: false,
        message: `Cannot reject verification with status: ${verification.verificationStatus}`
      });
      return;
    }

    // Update verification status
    verification.verificationStatus = 'rejected';
    verification.verifiedAt = new Date();
    verification.verifiedBy = `admin:${adminId}`;
    verification.rejectionReason = rejectionReason;
    await verification.save();

    // Update related order status if orderId exists
    if (verification.orderId) {
      await Order.findOneAndUpdate(
        { orderId: verification.orderId },
        { 
          paymentStatus: 'failed',
          status: 'payment_failed'
        }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Payment verification rejected successfully',
      data: verification
    });
  } catch (error) {
    console.error('Error rejecting payment verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject payment verification'
    });
  }
};

// Get payment verification statistics
export const getPaymentVerificationStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await PaymentVerification.aggregate([
      {
        $group: {
          _id: '$verificationStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const formattedStats = {
      pending: 0,
      verified: 0,
      rejected: 0,
      totalPending: 0,
      totalVerified: 0,
      totalRejected: 0
    };

    stats.forEach(stat => {
      switch (stat._id) {
        case 'pending':
          formattedStats.pending = stat.count;
          formattedStats.totalPending = stat.totalAmount;
          break;
        case 'verified':
          formattedStats.verified = stat.count;
          formattedStats.totalVerified = stat.totalAmount;
          break;
        case 'rejected':
          formattedStats.rejected = stat.count;
          formattedStats.totalRejected = stat.totalAmount;
          break;
      }
    });

    res.status(200).json({
      success: true,
      data: formattedStats
    });
  } catch (error) {
    console.error('Error fetching payment verification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment verification statistics'
    });
  }
};
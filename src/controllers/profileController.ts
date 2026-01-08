import { Response } from 'express';
import { z } from 'zod';
import { Customer } from '../models/Customer';
import { 
  asyncHandler, 
  NotFoundError
} from '../middleware/errorMiddleware';
import { CustomerAuthenticatedRequest } from '../middleware/customerAuthMiddleware';

// Validation schemas
const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  phone: z.string().regex(/^\d{10}$/, 'Invalid phone number').optional()
});

/**
 * @swagger
 * /api/v1/profile:
 *   get:
 *     summary: Get customer profile
 *     tags: [Profile]
 */
export const getProfile = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new NotFoundError('Customer not authenticated');
  }

  const customer = await Customer.findById(req.customer._id).select('-password -otp');
  
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  res.status(200).json({
    success: true,
    message: 'Profile retrieved successfully',
    data: customer
  });
});

/**
 * @swagger
 * /api/v1/profile:
 *   put:
 *     summary: Update customer profile
 *     tags: [Profile]
 */
export const updateProfile = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new NotFoundError('Customer not authenticated');
  }

  const validatedData = updateProfileSchema.parse(req.body);

  const customer = await Customer.findById(req.customer._id).select('-password -otp');
  
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  // Update fields
  if (validatedData.name !== undefined) {
    customer.name = validatedData.name;
  }
  if (validatedData.phone !== undefined) {
    customer.phone = validatedData.phone;
  }

  await customer.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: customer
  });
});

/**
 * @swagger
 * /api/v1/profile/orders-stats:
 *   get:
 *     summary: Get customer order statistics
 *     tags: [Profile]
 */
export const getOrderStats = asyncHandler(async (req: CustomerAuthenticatedRequest, res: Response) => {
  if (!req.customer) {
    throw new NotFoundError('Customer not authenticated');
  }

  const { Order } = await import('../models');

  const stats = await Order.aggregate([
    { $match: { customer: req.customer._id } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$totals.total' },
        statusCounts: {
          $push: '$status'
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalOrders: 1,
        totalSpent: 1,
        statusBreakdown: {
          PENDING: {
            $size: {
              $filter: {
                input: '$statusCounts',
                cond: { $eq: ['$$this', 'PENDING'] }
              }
            }
          },
          PAID: {
            $size: {
              $filter: {
                input: '$statusCounts',
                cond: { $eq: ['$$this', 'PAID'] }
              }
            }
          },
          SHIPPED: {
            $size: {
              $filter: {
                input: '$statusCounts',
                cond: { $eq: ['$$this', 'SHIPPED'] }
              }
            }
          },
          DELIVERED: {
            $size: {
              $filter: {
                input: '$statusCounts',
                cond: { $eq: ['$$this', 'DELIVERED'] }
              }
            }
          },
          CANCELLED: {
            $size: {
              $filter: {
                input: '$statusCounts',
                cond: { $eq: ['$$this', 'CANCELLED'] }
              }
            }
          }
        }
      }
    }
  ]);

  const result = stats.length > 0 ? stats[0] : {
    totalOrders: 0,
    totalSpent: 0,
    statusBreakdown: {
      PENDING: 0,
      PAID: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0
    }
  };

  res.status(200).json({
    success: true,
    message: 'Order statistics retrieved successfully',
    data: result
  });
});
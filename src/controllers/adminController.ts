import { Request, Response } from 'express';
import { z } from 'zod';
import { User, Product, Category, Order } from '../models';
import { 
  asyncHandler, 
  ValidationError, 
  NotFoundError 
} from '../middleware/errorMiddleware';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// Admin Dashboard Statistics
export const getDashboardStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Get basic counts
  const [userCount, productCount, categoryCount, orderCount] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    Product.countDocuments({ isActive: true }),
    Category.countDocuments({ isActive: true }),
    // Order.countDocuments() - uncomment when Order model is ready
    0 // placeholder
  ]);

  // Get recent products (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentProducts = await Product.countDocuments({
    createdAt: { $gte: thirtyDaysAgo },
    isActive: true
  });

  // Get recent users (last 30 days)
  const recentUsers = await User.countDocuments({
    createdAt: { $gte: thirtyDaysAgo },
    role: 'customer'
  });

  // Get top categories by product count
  const topCategories = await Product.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'categoryInfo'
      }
    },
    { $unwind: '$categoryInfo' },
    {
      $project: {
        _id: 0,
        name: '$categoryInfo.name',
        slug: '$categoryInfo.slug',
        productCount: '$count'
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      overview: {
        totalUsers: userCount,
        totalProducts: productCount,
        totalCategories: categoryCount,
        totalOrders: orderCount,
        recentProducts,
        recentUsers
      },
      topCategories
    }
  });
});

// Get All Users (Admin only)
export const getAllUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { 
    page = 1, 
    limit = 20, 
    search = '', 
    role = '', 
    sortBy = 'createdAt', 
    sortOrder = 'desc' 
  } = req.query;

  // Build filter
  const filter: any = {};
  
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (role && role !== 'all') {
    filter.role = role;
  }

  // Calculate pagination
  const skip = (Number(page) - 1) * Number(limit);
  const totalCount = await User.countDocuments(filter);
  const totalPages = Math.ceil(totalCount / Number(limit));

  // Build sort
  const sort: any = {};
  sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

  // Get users
  const users = await User.find(filter, '-password')
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalCount,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1
      }
    }
  });
});

// Get Single User (Admin only)
export const getUserById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const user = await User.findById(id, '-password');
  
  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json({
    success: true,
    data: { user }
  });
});

// Update User Role (Admin only)
export const updateUserRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  const updateSchema = z.object({
    role: z.enum(['customer', 'admin'], {
      errorMap: () => ({ message: 'Role must be either customer or admin' })
    })
  });

  const validatedData = updateSchema.parse({ role });

  const user = await User.findById(id);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Prevent admin from changing their own role
  if (user._id.toString() === req.user!._id.toString()) {
    throw new ValidationError('Cannot change your own role');
  }

  const updatedUser = await User.findByIdAndUpdate(
    id,
    { role: validatedData.role },
    { new: true, select: '-password' }
  );

  res.json({
    success: true,
    data: { user: updatedUser },
    message: `User role updated to ${validatedData.role}`
  });
});

// Delete User (Admin only)
export const deleteUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Prevent admin from deleting themselves
  if (user._id.toString() === req.user!._id.toString()) {
    throw new ValidationError('Cannot delete your own account');
  }

  // Prevent deleting other admins
  if (user.role === 'admin') {
    throw new ValidationError('Cannot delete admin users');
  }

  await User.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
});

// Get Recent Activity (Admin only)
export const getRecentActivity = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { limit = 10 } = req.query;

  // Get recent users
  const recentUsers = await User.find({ role: 'customer' }, 'name email createdAt')
    .sort({ createdAt: -1 })
    .limit(Number(limit) / 2);

  // Get recent products  
  const recentProducts = await Product.find({ isActive: true }, 'name price.selling createdAt')
    .populate('category', 'name')
    .sort({ createdAt: -1 })
    .limit(Number(limit) / 2);

  // Combine and sort by date
  const activities = [
    ...recentUsers.map(user => ({
      type: 'user_registered',
      title: `New user registered: ${user.name}`,
      subtitle: user.email,
      timestamp: user.createdAt,
      id: user._id
    })),
    ...recentProducts.map(product => ({
      type: 'product_created',
      title: `New product added: ${product.name}`,
      subtitle: `₹${product.price.selling} • ${(product.category as any)?.name || 'No Category'}`,
      timestamp: product.createdAt,
      id: product._id
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, Number(limit));

  res.json({
    success: true,
    data: { activities }
  });
});

// Get System Info (Admin only)
export const getSystemInfo = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const systemInfo = {
    version: process.env.npm_package_version || '1.0.0',
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    uptime: Math.floor(process.uptime()),
    memoryUsage: process.memoryUsage(),
    platform: process.platform
  };

  res.json({
    success: true,
    data: { systemInfo }
  });
});
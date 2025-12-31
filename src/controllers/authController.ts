import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User';
import { config } from '../config/env';
import { 
  asyncHandler, 
  ValidationError, 
  AuthError,
  NotFoundError 
} from '../middleware/errorMiddleware';
import { AuthenticatedRequest, JWTPayload } from '../middleware/authMiddleware';

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().regex(/^\d{10}$/, 'Invalid phone number').optional()
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters')
});

// Generate JWT token
const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload as any, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions);
};

// Register user
export const register = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = registerSchema.parse(req.body);

  // Check if user exists
  const existingUser = await User.findOne({ email: validatedData.email });
  if (existingUser) {
    throw new ValidationError('User already exists with this email');
  }

  // Create user
  const user = await User.create(validatedData);

  // Generate token
  const token = generateToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      },
      token
    }
  });
});

// Login user
export const login = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = loginSchema.parse(req.body);

  // Find user with password
  const user = await User.findOne({ email: validatedData.email }).select('+password');
  if (!user) {
    throw new AuthError('Invalid email or password');
  }

  // Check password
  const isPasswordValid = await user.comparePassword(validatedData.password);
  if (!isPasswordValid) {
    throw new AuthError('Invalid email or password');
  }

  // Generate token
  const token = generateToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      },
      token
    }
  });
});

// Get current user
export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AuthError('User not found');
  }

  res.json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        phone: req.user.phone,
        addresses: req.user.addresses
      }
    }
  });
});

// Update profile
export const updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AuthError('User not found');
  }

  const updateSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    phone: z.string().regex(/^\d{10}$/).optional(),
    addresses: z.array(z.object({
      type: z.enum(['billing', 'shipping']),
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(1),
      pincode: z.string().regex(/^\d{6}$/),
      country: z.string().default('India'),
      isDefault: z.boolean().default(false)
    })).optional()
  });

  const validatedData = updateSchema.parse(req.body);

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    validatedData,
    { new: true, runValidators: true }
  ).select('-password');

  if (!updatedUser) {
    throw new NotFoundError('User not found');
  }

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        addresses: updatedUser.addresses
      }
    }
  });
});

// Change password
export const changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new AuthError('User not found');
  }

  const validatedData = changePasswordSchema.parse(req.body);

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(validatedData.currentPassword);
  if (!isCurrentPasswordValid) {
    throw new AuthError('Current password is incorrect');
  }

  // Update password
  user.password = validatedData.newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
});

// Logout (client-side token removal)
export const logout = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});
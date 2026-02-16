import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
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

const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required')
});

// Initialize Google OAuth2 client
const client = new OAuth2Client(
  config.GOOGLE_CLIENT_ID
);

// Generate JWT token
const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions);
};

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *               phone:
 *                 type: string
 *                 pattern: ^\d{10}$
 *                 example: "1234567890"
 *     responses:
 *       201:
 *         description: User registered successfully
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
 *                   example: "User registered successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Path=/; HttpOnly
 *       400:
 *         description: Validation error or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.doe@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: User logged in successfully
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
 *                   example: "Login successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; Path=/; HttpOnly
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/v1/auth/google:
 *   post:
 *     summary: Google OAuth login/register for users (including admins)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Google ID token from frontend
 *               role:
 *                 type: string
 *                 enum: [customer, admin]
 *                 description: Role for new users (defaults to customer)
 *     responses:
 *       200:
 *         description: Google authentication successful
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
 *                   example: "Google login successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *       400:
 *         description: Invalid Google token
 *       500:
 *         description: Internal server error
 */
export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = googleAuthSchema.parse(req.body);
  const role = req.body.role === 'admin' ? 'admin' : 'customer'; // Default to customer

  try {
    // Verify the Google ID token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new AuthError('Invalid Google token');
    }

    const { sub: googleId, email, name, picture } = payload;
    
    if (!email || !name) {
      throw new AuthError('Google account must have email and name');
    }

    // Check if user already exists with this email
    let user = await User.findOne({ email });

    if (user) {
      // If user exists but doesn't have googleId, attach it
      if (!user.googleId) {
        user.googleId = googleId;
        user.provider = 'google';
        if (picture) user.avatar = picture;
        await user.save();
      }
    } else {
      // Create new user with Google OAuth
      user = await User.create({
        name,
        email,
        googleId,
        provider: 'google',
        role: role, // Use the role from request (admin or customer)
        avatar: picture || undefined,
        // password is not required for Google users due to schema validation
      });
    }

    // Generate token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      message: user.googleId ? 'Google login successful' : 'Account linked with Google',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          avatar: user.avatar,
          provider: user.provider
        },
        token
      }
    });

  } catch (error: any) {
    if (error.message?.includes('Token used too early') || error.message?.includes('Token used too late')) {
      throw new AuthError('Google token is expired or invalid');
    }
    throw new AuthError('Failed to verify Google token');
  }
});

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/v1/auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "John Doe Updated"
 *               phone:
 *                 type: string
 *                 pattern: ^\d{10}$
 *                 example: "9876543210"
 *               addresses:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [billing, shipping]
 *                       example: "shipping"
 *                     street:
 *                       type: string
 *                       example: "123 Main Street"
 *                     city:
 *                       type: string
 *                       example: "New Delhi"
 *                     state:
 *                       type: string
 *                       example: "Delhi"
 *                     pincode:
 *                       type: string
 *                       pattern: ^\d{6}$
 *                       example: "110001"
 *                     country:
 *                       type: string
 *                       default: "India"
 *                       example: "India"
 *                     isDefault:
 *                       type: boolean
 *                       default: false
 *                       example: true
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   put:
 *     summary: Change user password
 *     tags: [Authentication]
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
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "oldpassword123"
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: "newpassword123"
 *     responses:
 *       200:
 *         description: Password changed successfully
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
 *                   example: "Password changed successfully"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized or incorrect current password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logged out successfully
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
 *                   example: "Logged out successfully"
 *     description: Logout endpoint for client-side token removal. The client should remove the JWT token from storage/cookies.
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});
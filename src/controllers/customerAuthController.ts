import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Customer } from '../models/Customer';
import { config } from '../config/env';
import { emailService } from '../utils/emailService';
import { 
  asyncHandler, 
  ValidationError, 
  AuthError,
  NotFoundError,
  BadRequestError
} from '../middleware/errorMiddleware';

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

const verifyOTPSchema = z.object({
  email: z.string().email('Invalid email format'),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits')
});

const resendOTPSchema = z.object({
  email: z.string().email('Invalid email format')
});

interface CustomerJWTPayload {
  customerId: string;
  email: string;
  isEmailVerified: boolean;
}

// Generate JWT token for customer
const generateCustomerToken = (payload: CustomerJWTPayload): string => {
  return jwt.sign(payload, config.JWT_SECRET, { 
    expiresIn: config.JWT_EXPIRES_IN 
  } as jwt.SignOptions);
};

/**
 * @swagger
 * /api/v1/customers/register:
 *   post:
 *     summary: Register a new customer
 *     tags: [Customer Auth]
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
 *                 example: "John Customer"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.customer@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *               phone:
 *                 type: string
 *                 pattern: ^\d{10}$
 *                 example: "9876543210"
 *     responses:
 *       201:
 *         description: Customer registered successfully, OTP sent for verification
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
 *                   example: "Registration successful. Please verify your email with the OTP sent."
 *                 data:
 *                   type: object
 *                   properties:
 *                     customer:
 *                       $ref: '#/components/schemas/Customer'
 *       400:
 *         description: Validation error or customer already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
const getCookieOptions = () => ({
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: '/'
});

// Register customer
export const registerCustomer = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = registerSchema.parse(req.body);

  // Check if customer already exists
  const existingCustomer = await Customer.findOne({ email: validatedData.email });
  if (existingCustomer) {
    if (existingCustomer.isEmailVerified) {
      throw new ValidationError('Account already exists with this email');
    } else {
      // If user exists but not verified, generate new OTP and resend
      const otpData = existingCustomer.generateOTP();
      await existingCustomer.save();
      
      await emailService.sendOTPEmail(existingCustomer.email, {
        name: existingCustomer.name,
        otp: otpData.code
      });
      
      res.status(200).json({
        success: true,
        message: 'Account already exists but not verified. New OTP sent to your email.'
      });
      return;
    }
  }

  // Create new customer
  const customer = new Customer(validatedData);
  
  // Generate OTP
  const otpData = customer.generateOTP();
  
  // Save customer
  await customer.save();

  // Send OTP email
  try {
    await emailService.sendOTPEmail(customer.email, {
      name: customer.name,
      otp: otpData.code
    });
  } catch (error) {
    // If email fails, remove the customer and throw error
    await Customer.findByIdAndDelete(customer._id);
    console.error('Email sending failed:', error);
    throw new BadRequestError('Failed to send verification email. Please try again.');
  }

  res.status(201).json({
    success: true,
    message: 'Registration successful! Please check your email for verification code.',
    data: {
      email: customer.email,
      name: customer.name,
      otpExpiresAt: otpData.expiresAt
    }
  });
});

// Verify OTP
export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = verifyOTPSchema.parse(req.body);

  // Find customer
  const customer = await Customer.findOne({ email }).select('+otp');
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  if (customer.isEmailVerified) {
    throw new ValidationError('Email is already verified');
  }

  // Validate OTP
  if (!customer.isOTPValid(otp)) {
    throw new ValidationError('Invalid or expired OTP');
  }

  // Mark email as verified and clear OTP
  customer.isEmailVerified = true;
  customer.otp = undefined;
  await customer.save();

  // Send welcome email
  try {
    await emailService.sendWelcomeEmail(customer.email, customer.name);
  } catch (emailError) {
    console.error('Failed to send welcome email:', emailError);
    // Don't fail the verification if welcome email fails
  }

  // Generate token
  const token = generateCustomerToken({
    customerId: customer._id.toString(),
    email: customer.email,
    isEmailVerified: customer.isEmailVerified
  });

  // Set cookie
  res.cookie('customerToken', token, getCookieOptions());

  res.status(200).json({
    success: true,
    message: 'Email verified successfully! Welcome to HiPro Commerce.',
    data: {
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        isEmailVerified: customer.isEmailVerified
      },
      token
    }
  });
});

// Resend OTP
export const resendOTP = asyncHandler(async (req: Request, res: Response) => {
  const { email } = resendOTPSchema.parse(req.body);

  const customer = await Customer.findOne({ email });
  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  if (customer.isEmailVerified) {
    throw new ValidationError('Email is already verified');
  }

  // Generate new OTP
  const otpData = customer.generateOTP();
  await customer.save();

  // Send OTP email
  await emailService.sendOTPEmail(customer.email, {
    name: customer.name,
    otp: otpData.code
  });

  res.status(200).json({
    success: true,
    message: 'New verification code sent to your email',
    data: {
      otpExpiresAt: otpData.expiresAt
    }
  });
});

// Login customer
export const loginCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  // Find customer and include password for comparison
  const customer = await Customer.findOne({ email }).select('+password');
  if (!customer) {
    throw new AuthError('Invalid email or password');
  }

  // Check if email is verified
  if (!customer.isEmailVerified) {
    throw new AuthError('Please verify your email before logging in');
  }

  // Check password
  const isPasswordValid = await customer.comparePassword(password);
  if (!isPasswordValid) {
    throw new AuthError('Invalid email or password');
  }

  // Generate token
  const token = generateCustomerToken({
    customerId: customer._id.toString(),
    email: customer.email,
    isEmailVerified: customer.isEmailVerified
  });

  // Set cookie
  res.cookie('customerToken', token, getCookieOptions());

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        isEmailVerified: customer.isEmailVerified
      },
      token
    }
  });
});

// Logout customer
export const logoutCustomer = asyncHandler(async (req: Request, res: Response) => {
  // Clear the cookie
  res.clearCookie('customerToken', {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Get current customer profile
export const getCurrentCustomer = asyncHandler(async (req: Request, res: Response) => {
  // This will be called from protected routes where req.customer is available
  const customer = (req as any).customer;
  
  res.status(200).json({
    success: true,
    data: {
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        isEmailVerified: customer.isEmailVerified,
        addresses: customer.addresses,
        createdAt: customer.createdAt
      }
    }
  });
});

// Change password
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const customer = (req as any).customer;
  const { currentPassword, newPassword } = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters')
  }).parse(req.body);

  // Get customer with password
  const customerWithPassword = await Customer.findById(customer._id).select('+password');
  if (!customerWithPassword) {
    throw new NotFoundError('Customer not found');
  }

  // Verify current password
  const isCurrentPasswordValid = await customerWithPassword.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw new ValidationError('Current password is incorrect');
  }

  // Update password
  customerWithPassword.password = newPassword;
  await customerWithPassword.save();

  res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});
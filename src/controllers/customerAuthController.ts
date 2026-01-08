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
const sendOTPSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional().refine((val) => !val || val === '' || /^\d{10}$/.test(val), {
    message: 'Phone number must be exactly 10 digits'
  })
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional().refine((val) => !val || val === '' || /^\d{10}$/.test(val), {
    message: 'Phone number must be exactly 10 digits'
  }),
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits')
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
 * /api/v1/customers/send-otp:
 *   post:
 *     summary: Send OTP for customer registration
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
 *       200:
 *         description: OTP sent successfully
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
 *                   example: "Please check your email for verification code."
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                       example: "john.customer@example.com"
 *                     name:
 *                       type: string
 *                       example: "John Customer"
 *                     otpExpiresAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error or customer already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Send OTP for registration (new approach)
export const sendOTP = asyncHandler(async (req: Request, res: Response) => {
  const validatedData = sendOTPSchema.parse(req.body);

  // Check if customer already exists
  const existingCustomer = await Customer.findOne({ email: validatedData.email });
  if (existingCustomer) {
    throw new ValidationError('Account already exists with this email');
  }

  // Check if there's already a pending registration for this email
  const existingPending = pendingRegistrations.get(validatedData.email);
  if (existingPending) {
    // Remove old pending registration
    pendingRegistrations.delete(validatedData.email);
  }

  // Generate OTP
  const { otp, expiresAt } = generateOTP();
  
  // In development mode, log OTP to console for testing
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔐 [DEV] OTP for ${validatedData.email}: ${otp} (expires at ${expiresAt})`);
  }
  
  // Store registration data temporarily
  pendingRegistrations.set(validatedData.email, {
    userData: validatedData,
    otp,
    expiresAt
  });

  // Send OTP email - Real email delivery required
  try {
    console.log(`📧 Sending OTP email to: ${validatedData.email}`);
    
    await emailService.sendOTPEmail(validatedData.email, {
      name: validatedData.name,
      otp
    });
    
    console.log(`✅ OTP email sent successfully to ${validatedData.email}`);
  } catch (error) {
    // If email fails, remove pending registration and return error
    pendingRegistrations.delete(validatedData.email);
    console.error('❌ Email sending failed:', error);
    console.error('Error details:', {
      type: typeof error,
      message: error instanceof Error ? error.message : String(error),
      code: error instanceof Error ? (error as any).code : undefined,
      response: error instanceof Error ? (error as any).response : undefined
    });
    
    // Always fail if email cannot be sent - no development mode bypass
    if (error instanceof Error && (error.message.includes('SMTP is disabled') || error.message.includes('Disabled by user from hPanel'))) {
      throw new BadRequestError('SMTP email service is disabled in Hostinger control panel. Please enable SMTP in your Hostinger hPanel to send verification emails.');
    } else if (error instanceof Error && error.message.includes('authentication failed')) {
      throw new BadRequestError('Email service authentication failed. Please contact support.');
    } else if (error instanceof Error && (error as any).code === 'ECONNREFUSED') {
      throw new BadRequestError('Unable to connect to email server. Please try again later or contact support.');
    } else {
      throw new BadRequestError('Failed to send verification email. Please check your email address and try again.');
    }
  }

  res.status(200).json({
    success: true,
    message: 'Please check your email for verification code.',
    data: {
      email: validatedData.email,
      name: validatedData.name,
      otpExpiresAt: expiresAt
    }
  });
});

/**
 * @swagger
 * /api/v1/customers/register:
 *   post:
 *     summary: Complete customer registration with OTP verification
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
 *               - otp
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
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: "123456"
 *     responses:
 *       201:
 *         description: Customer registered successfully
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
 *                   example: "Account created successfully! You are now logged in."
 *                 data:
 *                   type: object
 *                   properties:
 *                     customer:
 *                       $ref: '#/components/schemas/Customer'
 *                     token:
 *                       type: string
 *       400:
 *         description: Validation error or invalid OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Register customer (updated to require OTP)
export const registerCustomer = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, phone, otp } = registerSchema.parse(req.body);

  // Check for pending registration
  const pendingRegistration = pendingRegistrations.get(email);
  if (!pendingRegistration) {
    throw new NotFoundError('No pending registration found. Please request OTP first.');
  }

  // Validate OTP
  if (!isOTPValid(pendingRegistration.otp, pendingRegistration.expiresAt, otp)) {
    throw new ValidationError('Invalid or expired OTP');
  }

  // Verify the provided data matches what was used to request OTP
  const { userData } = pendingRegistration;
  if (userData.name !== name || userData.email !== email || userData.password !== password || userData.phone !== phone) {
    throw new ValidationError('Registration data does not match OTP request');
  }

  // Check if customer already exists (safety check)
  const existingCustomer = await Customer.findOne({ email });
  if (existingCustomer) {
    // Remove pending registration
    pendingRegistrations.delete(email);
    throw new ValidationError('Account already exists with this email');
  }

  // Create the customer account
  const customer = new Customer({
    name,
    email,
    password,
    phone,
    isEmailVerified: true // Mark as verified since OTP is confirmed
  });

  await customer.save();

  // Remove pending registration
  pendingRegistrations.delete(email);

  // Generate token for auto-login
  const token = generateCustomerToken({
    customerId: customer._id.toString(),
    email: customer.email,
    isEmailVerified: customer.isEmailVerified
  });

  // Set cookie
  res.cookie('customerToken', token, getCookieOptions());

  res.status(201).json({
    success: true,
    message: 'Account created successfully! You are now logged in.',
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

// Temporary storage for pending registrations (in production, use Redis)
const pendingRegistrations = new Map<string, {
  userData: any;
  otp: string;
  expiresAt: Date;
}>();

// Helper function to generate OTP
const generateOTP = () => {
  // In development, use fixed OTP for easier testing
  const otp = process.env.NODE_ENV === 'development' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry
  return { otp, expiresAt };
};

// Helper function to validate OTP
const isOTPValid = (storedOTP: string, storedExpiry: Date, providedOTP: string): boolean => {
  return storedOTP === providedOTP && new Date() <= storedExpiry;
};

const getCookieOptions = () => ({
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: '/'
});

// Verify OTP (kept for backward compatibility and direct OTP verification)
export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = verifyOTPSchema.parse(req.body);

  // Check for pending registration
  const pendingRegistration = pendingRegistrations.get(email);
  if (!pendingRegistration) {
    throw new NotFoundError('No pending registration found for this email');
  }

  // Validate OTP
  if (!isOTPValid(pendingRegistration.otp, pendingRegistration.expiresAt, otp)) {
    throw new ValidationError('Invalid or expired OTP');
  }

  // Check if customer already exists (safety check)
  const existingCustomer = await Customer.findOne({ email });
  if (existingCustomer) {
    // Remove pending registration
    pendingRegistrations.delete(email);
    throw new ValidationError('Account already exists with this email');
  }

  // Create the customer account
  const customer = new Customer({
    ...pendingRegistration.userData,
    isEmailVerified: true // Mark as verified since OTP is confirmed
  });

  await customer.save();

  // Remove pending registration
  pendingRegistrations.delete(email);

  // Generate token for auto-login
  const token = generateCustomerToken({
    customerId: customer._id.toString(),
    email: customer.email,
    isEmailVerified: customer.isEmailVerified
  });

  // Set cookie
  res.cookie('customerToken', token, getCookieOptions());

  res.status(201).json({
    success: true,
    message: 'Account created successfully! You are now logged in.',
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

  // Check for pending registration
  const pendingRegistration = pendingRegistrations.get(email);
  if (!pendingRegistration) {
    throw new NotFoundError('No pending registration found for this email');
  }

  // Generate new OTP
  const { otp, expiresAt } = generateOTP();
  
  // Update pending registration with new OTP
  pendingRegistrations.set(email, {
    ...pendingRegistration,
    otp,
    expiresAt
  });

  // Send OTP email
  await emailService.sendOTPEmail(email, {
    name: pendingRegistration.userData.name,
    otp
  });

  res.status(200).json({
    success: true,
    message: 'New verification code sent to your email',
    data: {
      otpExpiresAt: expiresAt
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
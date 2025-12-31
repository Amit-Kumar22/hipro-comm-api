import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { Customer, ICustomer } from '../models/Customer';
import { config } from '../config/env';
import { AuthError } from './errorMiddleware';

interface CustomerJWTPayload {
  customerId: string;
  email: string;
  isEmailVerified: boolean;
  iat?: number;
  exp?: number;
}

export interface CustomerAuthenticatedRequest extends Request {
  customer?: ICustomer;
}

export const authenticateCustomer = async (
  req: CustomerAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // Get token from cookie first (preferred method)
    if (req.cookies && req.cookies.customerToken) {
      token = req.cookies.customerToken;
    }
    
    // Fallback to Authorization header for API calls
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      throw new AuthError('Please log in to access this resource');
    }

    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET) as CustomerJWTPayload;

    // Get customer from database
    const customer = await Customer.findById(decoded.customerId);
    if (!customer) {
      throw new AuthError('Customer not found. Please log in again.');
    }

    // Check if email is verified
    if (!customer.isEmailVerified) {
      throw new AuthError('Please verify your email before accessing this resource');
    }

    req.customer = customer;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      next(new AuthError('Invalid token. Please log in again.'));
    } else if (error.name === 'TokenExpiredError') {
      next(new AuthError('Your session has expired. Please log in again.'));
    } else {
      next(error);
    }
  }
};

// Optional authentication - doesn't throw error if no token
export const optionalCustomerAuth = async (
  req: CustomerAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // Get token from cookie first
    if (req.cookies && req.cookies.customerToken) {
      token = req.cookies.customerToken;
    }
    
    // Fallback to Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as CustomerJWTPayload;
        const customer = await Customer.findById(decoded.customerId);
        
        if (customer && customer.isEmailVerified) {
          req.customer = customer;
        }
      } catch (tokenError) {
        // Ignore token errors in optional auth
        console.log('Optional auth token error:', tokenError);
      }
    }

    next();
  } catch (error: any) {
    next(error);
  }
};

// Middleware to ensure customer is authenticated and email verified
export const requireCustomerAuth = async (
  req: CustomerAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.customer) {
    return next(new AuthError('Authentication required. Please log in.'));
  }

  if (!req.customer.isEmailVerified) {
    return next(new AuthError('Email verification required. Please verify your email.'));
  }

  next();
};

// Middleware to check if customer owns a resource (for cart, orders, etc.)
export const requireResourceOwnership = (resourceUserIdField: string = 'customerId') => {
  return async (req: CustomerAuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.customer) {
      return next(new AuthError('Authentication required'));
    }

    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (resourceUserId && resourceUserId !== req.customer._id.toString()) {
      return next(new AuthError('Access denied. You can only access your own resources.'));
    }

    next();
  };
};
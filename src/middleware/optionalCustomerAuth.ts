import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { Customer } from '../models/Customer';

export interface CustomerOptionalAuthRequest extends Request {
  customer?: any;
  isAuthenticated?: boolean;
}

export interface CustomerJWTPayload {
  customerId: string;
  email: string;
}

export const optionalCustomerAuth = async (
  req: CustomerOptionalAuthRequest,
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
      // No token provided - continue without authentication
      req.isAuthenticated = false;
      req.customer = null;
      return next();
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, config.JWT_SECRET) as CustomerJWTPayload;

      // Get customer from database
      const customer = await Customer.findById(decoded.customerId);
      if (!customer) {
        // Invalid customer - continue without authentication
        req.isAuthenticated = false;
        req.customer = null;
        return next();
      }

      // Attach customer to request
      req.customer = customer;
      req.isAuthenticated = true;
      next();
    } catch (jwtError) {
      // Invalid token - continue without authentication
      req.isAuthenticated = false;
      req.customer = null;
      next();
    }
  } catch (error) {
    console.error('Optional authentication middleware error:', error);
    // On any error, continue without authentication
    req.isAuthenticated = false;
    req.customer = null;
    next();
  }
};
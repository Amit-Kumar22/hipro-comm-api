import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { config } from '../config/env';
import { AuthError, ForbiddenError } from './errorMiddleware';

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'customer' | 'admin';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token: string | undefined;

    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      throw new AuthError('No token provided, authorization denied');
    }

    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET) as JWTPayload;

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      throw new AuthError('Token is not valid - user not found');
    }

    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      next(new AuthError('Token is not valid'));
    } else if (error.name === 'TokenExpiredError') {
      next(new AuthError('Token has expired'));
    } else {
      next(error);
    }
  }
};

export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AuthError('Authentication required'));
  }

  if (req.user.role !== 'admin') {
    return next(new ForbiddenError('Admin access required'));
  }

  next();
};

export const requireCustomer = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AuthError('Authentication required'));
  }

  if (req.user.role !== 'customer') {
    return next(new ForbiddenError('Customer access required'));
  }

  next();
};

export const requireOwnershipOrAdmin = (resourceUserIdField: string = 'userId') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthError('Authentication required'));
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    if (req.user._id.toString() !== resourceUserId) {
      return next(new ForbiddenError('Access denied - insufficient permissions'));
    }

    next();
  };
};
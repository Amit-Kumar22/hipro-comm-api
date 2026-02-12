import mongoose from 'mongoose';
import NodeCache from 'node-cache';
import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

// Initialize cache with 30 minute TTL
const cache = new NodeCache({ stdTTL: 1800 });

// Extend Request interface to include pagination
interface RequestWithPagination extends Request {
  pagination?: {
    page: number;
    limit: number;
    skip(): number;
  };
}

/**
 * Database Query Optimization Middleware
 */
export const optimizeMongoose = () => {
  // Enable query result caching
  mongoose.set('bufferCommands', false);
  
  // Optimize connection pooling
  mongoose.connection.on('connected', () => {
    console.log('🚀 MongoDB connection optimized for performance');
  });

  return (req: RequestWithPagination, res: Response, next: NextFunction) => {
    // Add pagination helpers
    const page = parseInt((req.query.page as string) || '1') || 1;
    const limit = Math.min(parseInt((req.query.limit as string) || '20') || 20, 100);
    
    req.pagination = {
      page,
      limit,
      skip: function() { return (this.page - 1) * this.limit; }
    };
    
    next();
  };
};

/**
 * Response Caching Middleware - DISABLED for real-time updates
 */
export const cacheResponse = (duration = 300) => { // 5 minutes default
  return (req: Request, res: Response, next: NextFunction) => {
    // DISABLED: Skip all caching for immediate updates
    console.log(`� Cache disabled for real-time updates: ${req.originalUrl}`);
    next();
  };
};

/**
 * Database Query Optimization Helpers
 */
export const optimizeQuery = {
  // Optimize product queries with selective fields
  productFields: 'name slug description price discountPrice images category stock isActive createdAt',
  
  // Optimize category queries
  categoryFields: 'name slug description image isActive productCount createdAt',
  
  // Common aggregation pipeline for products with category info
  productWithCategory: [
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryInfo',
        pipeline: [{ $project: { name: 1, slug: 1 } }]
      }
    },
    {
      $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true }
    }
  ],

  // Optimize search queries with indexes
  searchPipeline: (searchTerm: string) => [
    {
      $match: {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { 'categoryInfo.name': { $regex: searchTerm, $options: 'i' } }
        ],
        isActive: true
      }
    }
  ]
};

/**
 * Enhanced Compression Middleware
 */
export const optimizedCompression = () => {
  return compression({
    level: 6, // Good balance between speed and compression
    threshold: 1024, // Only compress files larger than 1KB
    filter: (req: Request, res: Response) => {
      // Compress JSON responses and static files
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  });
};

/**
 * Clear cache utility
 */
export const clearCache = (pattern?: string) => {
  const keys = cache.keys();
  const matchingKeys = pattern 
    ? keys.filter((key: string) => key.includes(pattern))
    : keys;
    
  matchingKeys.forEach((key: string) => cache.del(key));
  console.log(`🗑️ Cleared ${matchingKeys.length} cache entries`);
};

/**
 * Memory monitoring
 */
export const logMemoryUsage = () => {
  const usage = process.memoryUsage();
  const stats = cache.getStats();
  
  console.log('📊 Performance Stats:', {
    memory: {
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`
    },
    cache: {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits > 0 ? `${Math.round((stats.hits / (stats.hits + stats.misses)) * 100)}%` : '0%'
    }
  });
};

// Monitor memory usage every 5 minutes
setInterval(logMemoryUsage, 300000);

export default {
  optimizeMongoose,
  cacheResponse,
  optimizeQuery,
  optimizedCompression,
  clearCache,
  logMemoryUsage
};
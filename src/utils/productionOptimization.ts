/**
 * Production Performance Optimization - API Server
 * 
 * इस file में production में slow loading की सभी major issues का solution है
 */

// 1. Database Connection Pool Optimization
import mongoose from 'mongoose';
import { config } from '../config/env';

export const optimizeProductionDatabase = async () => {
  const options = {
    // Connection pooling - production के लिए optimized
    maxPoolSize: 20, // Maximum connections in pool
    minPoolSize: 2,  // Minimum connections in pool
    maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
    
    // Connection timeout optimization
    serverSelectionTimeoutMS: 5000, // 5 seconds timeout for server selection
    socketTimeoutMS: 30000, // 30 seconds socket timeout
    connectTimeoutMS: 10000, // 10 seconds connection timeout
    
    // Performance optimizations
    bufferCommands: false, // Disable mongoose buffering
    bufferMaxEntries: 0,   // Disable mongoose buffer
    
    // Retry logic for production
    retryWrites: true,
  };
  
  try {
    await mongoose.connect(config.MONGODB_URI, options);
    console.log('🚀 Production database connection optimized');
  } catch (error) {
    console.error('❌ Production database connection failed:', error);
    // Fallback to default connection
    await mongoose.connect(config.MONGODB_URI);
    console.log('⚠️ Connected with default settings');
  }
};

// 2. Advanced Caching Strategy
import NodeCache from 'node-cache';

class ProductionCache {
  private memoryCache: NodeCache;
  private cacheKeys: Set<string> = new Set();
  
  constructor() {
    // Memory cache for frequently accessed data
    this.memoryCache = new NodeCache({ 
      stdTTL: 300, // 5 minutes
      checkperiod: 60, // Check expired keys every minute
      maxKeys: 1000 // Maximum 1000 keys in memory
    });
  }
  
  async get(key: string): Promise<any> {
    // Try memory cache first (fastest)
    let data = this.memoryCache.get(key);
    if (data) {
      console.log(`⚡ Memory cache hit: ${key}`);
      return data;
    }
    
    return null;
  }
  
  async set(key: string, data: any, ttl: number = 300): Promise<void> {
    // Store in memory cache
    this.memoryCache.set(key, data, Math.min(ttl, 300)); // Max 5 minutes in memory
    this.cacheKeys.add(key);
    console.log(`💾 Cached in memory: ${key}`);
  }
  
  async clear(pattern?: string): Promise<void> {
    if (pattern) {
      const keysToDelete = Array.from(this.cacheKeys).filter(key => 
        key.includes(pattern) || 
        key.startsWith('products_') || 
        key.startsWith('categories_')
      );
      keysToDelete.forEach(key => {
        this.memoryCache.del(key);
        this.cacheKeys.delete(key);
      });
      console.log(`🧹 Cleared ${keysToDelete.length} cache entries for pattern: ${pattern}`);
    } else {
      this.memoryCache.flushAll();
      this.cacheKeys.clear();
      console.log('🧹 Cleared all cache');
    }
  }
  
  // NEW: Force clear all product-related cache
  async clearAllProductCache(): Promise<void> {
    const productKeys = Array.from(this.cacheKeys).filter(key => 
      key.includes('product') || key.includes('category') || key.includes('inventory')
    );
    productKeys.forEach(key => {
      this.memoryCache.del(key);
      this.cacheKeys.delete(key);
    });
    console.log(`🔥 Force cleared ${productKeys.length} product-related cache entries`);
  }
}

export const productionCache = new ProductionCache();

// 3. Database Query Optimization
export const ProductionQueryOptimizer = {
  // Products के लिए optimized aggregation pipeline
  getProductsPipeline: (filters: any = {}, page = 1, limit = 20) => {
    const pipeline: any[] = [];
    
    // Match stage with proper indexing
    const matchStage: any = { isActive: true };
    
    if (filters.category) {
      matchStage.category = filters.category;
    }
    
    if (filters.search) {
      matchStage.$text = { $search: filters.search };
    }
    
    if (filters.priceRange) {
      matchStage.price = {
        $gte: filters.priceRange.min,
        $lte: filters.priceRange.max
      };
    }
    
    pipeline.push({ $match: matchStage });
    
    // Lookup stage for category info (optimized)
    pipeline.push({
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryInfo',
        pipeline: [{ $project: { name: 1, slug: 1 } }]
      }
    });
    
    // Unwind category
    pipeline.push({
      $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true }
    });
    
    // Project only required fields
    pipeline.push({
      $project: {
        name: 1,
        slug: 1,
        description: 1,
        price: 1,
        discountPrice: 1,
        images: { $slice: ['$images', 2] }, // Only first 2 images
        'categoryInfo.name': 1,
        'categoryInfo.slug': 1,
        stock: 1,
        createdAt: 1
      }
    });
    
    // Sort by relevance or date
    if (filters.search) {
      pipeline.push({ $sort: { score: { $meta: 'textScore' }, createdAt: -1 } });
    } else {
      pipeline.push({ $sort: { createdAt: -1 } });
    }
    
    // Pagination
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: limit });
    
    return pipeline;
  },
  
  // Categories के लिए optimized query
  getCategoriesPipeline: () => [
    { $match: { isActive: true } },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: 'category',
        as: 'products',
        pipeline: [
          { $match: { isActive: true } },
          { $count: 'count' }
        ]
      }
    },
    {
      $addFields: {
        productCount: { $ifNull: [{ $arrayElemAt: ['$products.count', 0] }, 0] }
      }
    },
    {
      $project: {
        name: 1,
        slug: 1,
        description: 1,
        image: 1,
        productCount: 1,
        createdAt: 1
      }
    },
    { $sort: { createdAt: -1 } }
  ]
};

// 4. Response Compression और Optimization
import { Request, Response, NextFunction } from 'express';
import compression from 'compression';

export const productionCompression = compression({
  level: 9, // Maximum compression for production
  threshold: 512, // Compress files larger than 512 bytes
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
});

// 5. API Response Optimization Middleware
export const optimizeApiResponse = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    
    res.json = function(data: any) {
      // Add performance headers - FIXED: No caching for immediate updates
      const isProductRoute = req.path.includes('/products') || req.path.includes('/categories');
      const isAdminRoute = req.headers.authorization?.startsWith('Bearer ');
      
      res.set({
        // No caching for product data to ensure real-time updates
        'Cache-Control': isProductRoute || isAdminRoute ? 'no-cache, no-store, must-revalidate' : (req.method === 'GET' ? 'public, max-age=60' : 'no-cache'),
        'Pragma': isProductRoute || isAdminRoute ? 'no-cache' : undefined,
        'Expires': isProductRoute || isAdminRoute ? '0' : undefined,
        'X-Response-Time': `${Date.now() - (req as any).startTime}ms`,
        'X-Powered-By': 'HiproTech-Optimized'
      });
      
      // Compress response data if it's large
      if (data && typeof data === 'object') {
        // Remove unnecessary fields for API responses
        if (data.data && Array.isArray(data.data)) {
          data.data = data.data.map((item: any) => {
            if (item.images && item.images.length > 3) {
              item.images = item.images.slice(0, 3); // Only send first 3 images
            }
            return item;
          });
        }
      }
      
      return originalJson.call(this, data);
    };
    
    (req as any).startTime = Date.now();
    next();
  };
};

// 6. Database Indexes for Production Performance
export const createProductionIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error('Database connection not established');
    }
    
    // Products collection indexes
    await db.collection('products').createIndexes([
      { key: { name: 'text', description: 'text' }, name: 'text_search_index' },
      { key: { category: 1, isActive: 1 }, name: 'category_active_index' },
      { key: { price: 1 }, name: 'price_index' },
      { key: { createdAt: -1 }, name: 'created_date_index' },
      { key: { slug: 1 }, name: 'slug_index', unique: true },
      { key: { isActive: 1, createdAt: -1 }, name: 'active_recent_index' }
    ]);
    
    // Categories collection indexes
    await db.collection('categories').createIndexes([
      { key: { slug: 1 }, name: 'category_slug_index', unique: true },
      { key: { isActive: 1 }, name: 'category_active_index' },
      { key: { name: 1 }, name: 'category_name_index' }
    ]);
    
    // Orders collection indexes
    await db.collection('orders').createIndexes([
      { key: { customer: 1, createdAt: -1 }, name: 'customer_orders_index' },
      { key: { status: 1 }, name: 'order_status_index' },
      { key: { paymentStatus: 1 }, name: 'payment_status_index' }
    ]);
    
    // Users collection indexes
    await db.collection('users').createIndexes([
      { key: { email: 1 }, name: 'user_email_index', unique: true },
      { key: { role: 1, isActive: 1 }, name: 'user_role_active_index' }
    ]);
    
    console.log('✅ Production database indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating database indexes:', error);
  }
};

// 7. Memory Management और Monitoring
export const ProductionMonitor = {
  logPerformanceStats: () => {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    console.log('📊 Production Performance Stats:', {
      memory: {
        rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(usage.external / 1024 / 1024)}MB`
      },
      uptime: `${Math.round(process.uptime())} seconds`,
      connections: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
  },
  
  // Memory cleanup function
  performGarbageCollection: () => {
    if (global.gc) {
      global.gc();
      console.log('🗑️ Garbage collection performed');
    }
  },
  
  // Monitor और cleanup every 5 minutes
  startMonitoring: () => {
    setInterval(() => {
      ProductionMonitor.logPerformanceStats();
      
      // Perform garbage collection if memory usage is high
      const usage = process.memoryUsage();
      if (usage.heapUsed > 500 * 1024 * 1024) { // If heap usage > 500MB
        ProductionMonitor.performGarbageCollection();
      }
    }, 300000); // Every 5 minutes
  }
};

export default {
  optimizeProductionDatabase,
  productionCache,
  ProductionQueryOptimizer,
  productionCompression,
  optimizeApiResponse,
  createProductionIndexes,
  ProductionMonitor
};
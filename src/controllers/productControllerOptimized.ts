import { Request, Response } from 'express';
import { Product, Category, Inventory } from '../models';
import { asyncHandler } from '../middleware/errorMiddleware';
import { 
  calculatePagination, 
  parseStandardizedQuery,
  buildSortObject,
  buildSearchFilter,
  createStandardizedResponse
} from '../utils/helpers.js';
import { productionCache, ProductionQueryOptimizer } from '../utils/productionOptimization';

/**
 * Optimized Get Products Controller
 * 
 * Production में performance के लिए optimized version
 */
export const getProductsOptimized = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Parse standardized query parameters
  const { page, size, sortBy, sortOrder, search } = parseStandardizedQuery(req.query);
  
  // Extract additional filters
  const {
    category = '',
    minPrice = 0,
    maxPrice = 999999,
    featured,
    inStock,
    isActive = true
  } = req.query;

  // Create cache key based on query parameters
  const cacheKey = `products_${JSON.stringify({
    page, size, sortBy, sortOrder, search, category, minPrice, maxPrice, featured, inStock, isActive
  })}`;

  // Try to get from cache first (केवल production में)
  if (process.env.NODE_ENV === 'production') {
    const cachedResult = await productionCache.get(cacheKey);
    if (cachedResult) {
      console.log(`📦 Cache hit for products query: ${search || 'all'}`);
      res.json(cachedResult);
      return;
    }
  }

  // Build filters for aggregation pipeline
  const filters = {
    category: category || undefined,
    search: search || undefined,
    priceRange: Number(minPrice) > 0 || Number(maxPrice) < 999999 ? { min: Number(minPrice), max: Number(maxPrice) } : undefined,
    featured: featured === 'true' ? true : undefined,
    isActive: isActive === 'true' || isActive === true
  };

  // Use optimized aggregation pipeline
  const pipeline = ProductionQueryOptimizer.getProductsPipeline(filters, page, size);
  
  // Execute aggregation with inventory lookup in single query
  const optimizedPipeline = [
    ...pipeline,
    // Add inventory lookup in the same aggregation
    {
      $lookup: {
        from: 'inventories',
        localField: '_id',
        foreignField: 'product',
        as: 'inventoryData',
        pipeline: [
          { $match: { isActive: true } },
          {
            $project: {
              availableForSale: 1,
              quantityAvailable: 1,
              quantityReserved: 1,
              isOutOfStock: 1,
              isLowStock: 1,
              reorderLevel: 1
            }
          }
        ]
      }
    },
    {
      $addFields: {
        inventory: {
          $ifNull: [
            { $arrayElemAt: ['$inventoryData', 0] },
            {
              availableForSale: 0,
              quantityAvailable: 0,
              quantityReserved: 0,
              isOutOfStock: true,
              isLowStock: false,
              reorderLevel: 0
            }
          ]
        }
      }
    },
    {
      $unset: 'inventoryData'
    }
  ];

  // Add stock filter to pipeline if needed
  if (inStock === 'true') {
    optimizedPipeline.push({
      $match: {
        'inventory.availableForSale': { $gt: 0 }
      }
    });
  }

  // Execute the optimized query
  const [products, totalCount] = await Promise.all([
    Product.aggregate(optimizedPipeline),
    
    // Count query with same filters (but without pagination)
    Product.aggregate([
      { $match: { 
        isActive: filters.isActive,
        ...(filters.category && { category: filters.category }),
        ...(filters.search && { $text: { $search: filters.search } }),
        ...(filters.priceRange && {
          price: {
            $gte: filters.priceRange.min,
            $lte: filters.priceRange.max
          }
        }),
        ...(filters.featured && { isFeatured: true })
      }},
      { $count: 'total' }
    ])
  ]);

  const totalElements = totalCount[0]?.total || 0;
  const pagination = calculatePagination(page, size, totalElements);

  // Create standardized response
  const response = createStandardizedResponse(products, pagination);

  const finalResponse = {
    success: true,
    ...response
  };

  // Cache the result for 5 minutes in production
  if (process.env.NODE_ENV === 'production') {
    await productionCache.set(cacheKey, finalResponse, 300); // 5 minutes
    console.log(`💾 Cached products query: ${search || 'all'}`);
  }

  res.json(finalResponse);
});

/**
 * Optimized Get Single Product Controller
 */
export const getProductBySlugOptimized = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  
  // Create cache key
  const cacheKey = `product_${slug}`;
  
  // Try cache first in production
  if (process.env.NODE_ENV === 'production') {
    const cachedProduct = await productionCache.get(cacheKey);
    if (cachedProduct) {
      console.log(`📦 Cache hit for product: ${slug}`);
      res.json(cachedProduct);
      return;
    }
  }

  // Optimized aggregation for single product
  const pipeline = [
    { $match: { slug, isActive: true } },
    
    // Lookup category
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'categoryInfo',
        pipeline: [{ $project: { name: 1, slug: 1 } }]
      }
    },
    
    // Lookup inventory
    {
      $lookup: {
        from: 'inventories',
        localField: '_id',
        foreignField: 'product',
        as: 'inventoryData',
        pipeline: [
          { $match: { isActive: true } },
          {
            $project: {
              availableForSale: 1,
              quantityAvailable: 1,
              quantityReserved: 1,
              isOutOfStock: 1,
              isLowStock: 1,
              reorderLevel: 1,
              lowStockThreshold: 1
            }
          }
        ]
      }
    },
    
    // Process the lookups
    {
      $addFields: {
        category: { $arrayElemAt: ['$categoryInfo', 0] },
        inventory: {
          $ifNull: [
            { $arrayElemAt: ['$inventoryData', 0] },
            {
              availableForSale: 0,
              quantityAvailable: 0,
              quantityReserved: 0,
              isOutOfStock: true,
              isLowStock: false,
              reorderLevel: 0,
              lowStockThreshold: 10
            }
          ]
        }
      }
    },
    
    // Clean up
    {
      $unset: ['categoryInfo', 'inventoryData']
    }
  ];

  const products = await Product.aggregate(pipeline);
  
  if (!products.length) {
    res.status(404).json({
      success: false,
      message: 'Product not found'
    });
    return;
  }

  const product = products[0];
  const response = {
    success: true,
    data: product
  };

  // Cache for 10 minutes in production
  if (process.env.NODE_ENV === 'production') {
    await productionCache.set(cacheKey, response, 600); // 10 minutes
    console.log(`💾 Cached product: ${slug}`);
  }

  res.json(response);
});

/**
 * Optimized Categories with Product Count
 */
export const getCategoriesOptimized = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const cacheKey = 'categories_with_products';
  
  // Try cache first
  if (process.env.NODE_ENV === 'production') {
    const cachedCategories = await productionCache.get(cacheKey);
    if (cachedCategories) {
      console.log('📦 Cache hit for categories');
      res.json(cachedCategories);
      return;
    }
  }

  // Simple categories query with product count
  const categories = await Category.find({ isActive: true })
    .select('name slug description image createdAt')
    .sort({ createdAt: -1 });

  const response = {
    success: true,
    data: categories
  };

  // Cache for 15 minutes
  if (process.env.NODE_ENV === 'production') {
    await productionCache.set(cacheKey, response, 900); // 15 minutes
    console.log('💾 Cached categories');
  }

  res.json(response);
});

/**
 * Clear cache when products are updated
 */
export const clearProductCache = () => {
  if (process.env.NODE_ENV === 'production') {
    productionCache.clear('products');
    productionCache.clear('categories');
    console.log('🗑️ Cleared product cache');
  }
};

export default {
  getProductsOptimized,
  getProductBySlugOptimized,
  getCategoriesOptimized,
  clearProductCache
};
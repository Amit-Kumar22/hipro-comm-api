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

/**
 * Optimized Get Products Controller
 * 
 * Production में performance के लिए optimized version
 */
export const getProductsOptimized = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Parse standardized query parameters
  const { page = 1, size = 10, sortBy, sortOrder, search } = parseStandardizedQuery(req.query);
  
  // Set sort field
  const sortField = sortBy || 'createdAt';
  
  // Extract additional filters
  const {
    category = '',
    minPrice = 0,
    maxPrice = 999999,
    featured,
    inStock,
    isActive = true
  } = req.query;

  console.log('🚀 NO CACHE: Direct database query for immediate results');

  // Build simple filters for fast query
  const matchFilter: any = {
    isActive: isActive === 'true' || isActive === true,
    ...(category && { category }),
    ...(search && { $text: { $search: search } }),
    ...(featured === 'true' && { isFeatured: true })
  };

  // Add price range filter if needed
  if (Number(minPrice) > 0 || Number(maxPrice) < 999999) {
    matchFilter['price.selling'] = {
      $gte: Number(minPrice),
      $lte: Number(maxPrice)
    };
  }

  // Use simple queries for immediate response - NO COMPLEX AGGREGATION
  let products, totalCount;
  let totalElements = 0;

  console.log('🚀 SIMPLE QUERY: Using fast simple queries for immediate response');
  
  [products, totalElements] = await Promise.all([
    Product.find(matchFilter)
      .populate('category', 'name slug')
      .sort({ [sortField]: sortOrder === 'asc' ? 1 : -1 })
      .skip((page - 1) * size)
      .limit(size)
      .lean(),
    
    Product.countDocuments(matchFilter)
  ]);

  // Add simple inventory data
  for (let product of products) {
    const inventory = await Inventory.findOne({ product: product._id, isActive: true }).lean();
    (product as any).inventory = inventory || {
      availableForSale: 0,
      quantityAvailable: 0,
      quantityReserved: 0,
      isOutOfStock: true,
      isLowStock: false,
      reorderLevel: 0
    };
  }
  const pagination = calculatePagination(page, size, totalElements);

  // Create standardized response
  const response = createStandardizedResponse(products, pagination);

  const finalResponse = {
    success: true,
    ...response
  };

  console.log('✅ Direct response - NO CACHING for immediate updates');
  res.json(finalResponse);
});

/**
 * Optimized Get Single Product Controller
 */
export const getProductBySlugOptimized = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  
  console.log('🚀 NO CACHE: Direct product query for immediate results');

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

  console.log('✅ Direct product response - NO CACHING');
  res.json(response);
});

/**
 * Optimized Categories with Product Count
 */
export const getCategoriesOptimized = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  console.log('🚀 NO CACHE: Direct categories query for immediate results');

  // Simple categories query with product count
  const categories = await Category.find({ isActive: true })
    .select('name slug description image createdAt')
    .sort({ createdAt: -1 });

  const response = {
    success: true,
    data: categories
  };

  console.log('✅ Direct categories response - NO CACHING');
  res.json(response);
});

/**
 * Clear cache when products are updated
 */
export const clearProductCache = async () => {
  // No cache to clear - direct database queries for immediate updates
  console.log('✅ NO CACHE to clear - using direct database queries');
};

export default {
  getProductsOptimized,
  getProductBySlugOptimized,
  getCategoriesOptimized,
  clearProductCache
};
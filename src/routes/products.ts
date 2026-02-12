import { Router } from 'express';
import {
  getProducts,
  getProduct,
  getProductBySlug,
  createProduct,
  updateProduct,
  updateProductStock,
  deleteProduct,
  getFeaturedProducts,
  getProductsByCategory,
  getDeletedProducts,
  restoreProduct
} from '../controllers/productController';
import { authenticate, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/by-slug/:slug', getProductBySlug);
router.get('/category/:categoryId', getProductsByCategory);

// Protected routes (Admin only) - MUST come BEFORE /:id route
router.get('/deleted', authenticate, requireAdmin, getDeletedProducts);
router.post('/:id/restore', authenticate, requireAdmin, restoreProduct);

// Public route with dynamic ID - MUST come AFTER specific routes
router.get('/:id', getProduct);
router.post('/', authenticate, requireAdmin, createProduct);
router.put('/:id', authenticate, requireAdmin, updateProduct);
router.patch('/:id/stock', authenticate, requireAdmin, updateProductStock);
router.delete('/:id', authenticate, requireAdmin, deleteProduct);

export default router;
import { Router } from 'express';
import {
  getProducts,
  getProduct,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getProductsByCategory
} from '../controllers/productController';
import { authenticate, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/by-slug/:slug', getProductBySlug);
router.get('/category/:categoryId', getProductsByCategory);
router.get('/:id', getProduct);

// Protected routes (Admin only)
router.post('/', authenticate, requireAdmin, createProduct);
router.put('/:id', authenticate, requireAdmin, updateProduct);
router.delete('/:id', authenticate, requireAdmin, deleteProduct);

export default router;
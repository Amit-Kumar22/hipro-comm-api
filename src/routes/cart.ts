import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartItemsCount
} from '../controllers/cartController';
import { authenticateCustomer } from '../middleware/customerAuthMiddleware';

const router = Router();

// All cart routes require customer authentication
router.use(authenticateCustomer);

// Cart management routes
router.get('/', getCart);
router.post('/add', addToCart);
router.put('/item/:itemId', updateCartItem);
router.delete('/item/:itemId', removeFromCart);
router.delete('/clear', clearCart);
router.get('/count', getCartItemsCount);

export default router;
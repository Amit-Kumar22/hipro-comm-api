import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  validateCart,
  getCartCount
} from '../controllers/cartController';
import { authenticateCustomer } from '../middleware/customerAuthMiddleware';

const router = Router();

// All cart routes require customer authentication
router.use(authenticateCustomer);

// Cart management routes
router.get('/', getCart);                    // Get cart
router.post('/add', addToCart);              // Add item to cart
router.put('/item/:itemId', updateCartItem); // Update item quantity
router.delete('/item/:itemId', removeCartItem); // Remove item from cart
router.delete('/clear', clearCart);          // Clear entire cart
router.post('/validate', validateCart);      // Validate cart before checkout
router.get('/count', getCartCount);          // Get cart items count

export default router;
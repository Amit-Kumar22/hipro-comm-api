import { Router } from 'express';
import { 
  getProfile, 
  updateProfile, 
  getOrderStats 
} from '../controllers/profileController';
import { authenticateCustomer } from '../middleware/customerAuthMiddleware';

const router = Router();

// All profile routes require customer authentication
router.use(authenticateCustomer);

// Profile routes
router.get('/', getProfile);
router.put('/', updateProfile);
router.get('/orders-stats', getOrderStats);

export default router;
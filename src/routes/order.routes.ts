/**
 * Order Routes (Customer)
 *
 * Customer-facing order endpoints.
 * All routes require authentication.
 */

import { Router } from 'express';
import * as orderController from '@/controllers/order.controller';
import { authenticate } from '@/middleware/auth';
import { orderLimiter, standardLimiter } from '@/middleware/rateLimiter';

const router = Router();

/**
 * POST /api/v1/orders
 *
 * Create a new order with payment processing
 * Requires authentication
 * Rate limited to prevent spam orders (20 orders per hour)
 */
router.post('/', authenticate, orderLimiter, orderController.createOrder);

/**
 * GET /api/v1/orders
 *
 * Get current user's orders with pagination
 * Query params: ?page=1&limit=10&status=PREPARING
 * Requires authentication
 */
router.get('/', authenticate, standardLimiter, orderController.getUserOrders);

/**
 * GET /api/v1/orders/:orderId
 *
 * Get order details by ID
 * Only accessible by order owner or admin
 * Requires authentication
 */
router.get('/:orderId', authenticate, standardLimiter, orderController.getOrderById);

/**
 * GET /api/v1/orders/:orderId/status
 *
 * Get order status (lightweight endpoint for polling)
 * Returns only status and estimated ready time
 * Requires authentication
 */
router.get('/:orderId/status', authenticate, standardLimiter, orderController.getOrderStatus);

export default router;

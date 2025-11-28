/**
 * Routes Index
 *
 * Combines all API routes and exports a single router.
 * Provides API versioning with /api/v1 prefix.
 */

import { Router } from 'express';
import authRoutes from './auth.routes';
import menuRoutes from './menu.routes';
import orderRoutes from './order.routes';
import adminRoutes from './admin.routes';
import printRoutes from './print.routes';

const router = Router();

/**
 * API v1 Routes
 */
router.use('/auth', authRoutes);
router.use('/menu', menuRoutes);
router.use('/orders', orderRoutes);
router.use('/admin', adminRoutes);
router.use('/print', printRoutes);

/**
 * Health check endpoint
 * GET /api/v1/health
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

export default router;

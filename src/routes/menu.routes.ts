/**
 * Menu Routes
 *
 * Defines routes for menu management.
 * Public endpoints (cached, no auth) and admin endpoints (auth + admin required).
 */

import { Router } from 'express';
import * as menuController from '@/controllers/menu.controller';
import { standardLimiter } from '@/middleware/rateLimiter';

const router = Router();

// ============================================================================
// PUBLIC ROUTES (NO AUTH REQUIRED)
// ============================================================================

/**
 * GET /api/v1/menu/categories
 *
 * Get all active categories sorted by displayOrder
 * Includes item count per category
 * Response cached for 5 minutes
 */
router.get('/categories', standardLimiter, menuController.getCategories);

/**
 * GET /api/v1/menu/categories/:categoryId/items
 *
 * Get available menu items in a category
 * Includes modifierGroups with modifiers
 * Query params: ?popular=true to filter for popular items
 * Response cached for 5 minutes
 */
router.get('/categories/:categoryId/items', standardLimiter, menuController.getCategoryItems);

/**
 * GET /api/v1/menu/items/:itemId
 *
 * Get single menu item with full details
 * Includes all modifier groups and modifiers
 * Returns 404 if not found or not available
 * Response cached for 5 minutes
 */
router.get('/items/:itemId', standardLimiter, menuController.getItemById);

/**
 * GET /api/v1/menu/search?q=query
 *
 * Search items by name/description (case-insensitive)
 * Returns matching items across all categories
 * Limit 20 results
 * Response cached for 5 minutes
 */
router.get('/search', standardLimiter, menuController.searchItems);

/**
 * GET /api/v1/menu/featured
 *
 * Get featured items (isPopular=true)
 * Limit 10 items
 * Response cached for 5 minutes
 */
router.get('/featured', standardLimiter, menuController.getFeaturedItems);

export default router;

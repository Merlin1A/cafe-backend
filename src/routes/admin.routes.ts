/**
 * Admin Routes
 *
 * Defines routes for admin and staff operations.
 * All routes require authentication and appropriate role.
 */

import { Router } from 'express';
import * as adminController from '@/controllers/admin.controller';
import * as menuController from '@/controllers/menu.controller';
import * as orderController from '@/controllers/order.controller';
import uploadRoutes from '@/routes/upload.routes';
import { authenticate } from '@/middleware/auth';
import { requireAdmin } from '@/middleware/admin';
import { readLimiter, writeLimiter } from '@/middleware/rateLimiter';

const router = Router();

// ============================================================================
// ORDER MANAGEMENT ROUTES (Staff/Admin)
// ============================================================================

/**
 * GET /api/v1/admin/orders
 * Get all orders with filtering (status, date)
 * Staff, Admin, or Super Admin only
 */
router.get('/orders', authenticate, requireAdmin, readLimiter, orderController.getAllOrders);

/**
 * GET /api/v1/admin/orders/active
 * Get active orders (for kitchen display)
 * Returns non-completed orders sorted by createdAt (oldest first)
 * Staff, Admin, or Super Admin only
 */
router.get('/orders/active', authenticate, requireAdmin, readLimiter, orderController.getActiveOrders);

/**
 * PUT /api/v1/admin/orders/:orderId/status
 * Update order status
 * Staff, Admin, or Super Admin only
 */
router.put(
  '/orders/:orderId/status',
  authenticate,
  requireAdmin,
  writeLimiter,
  orderController.updateOrderStatus
);

/**
 * POST /api/v1/admin/orders/:orderId/refund
 * Refund an order (full or partial)
 * Admin or Super Admin only
 */
router.post('/orders/:orderId/refund', authenticate, requireAdmin, writeLimiter, orderController.refundOrder);

// ============================================================================
// USER MANAGEMENT ROUTES (Admin)
// ============================================================================

/**
 * GET /api/v1/admin/users
 * Get all users with filtering
 * Admin or Super Admin only
 */
router.get('/users', authenticate, requireAdmin, readLimiter, adminController.getAllUsers);

/**
 * GET /api/v1/admin/users/:id
 * Get user by ID
 * Admin or Super Admin only
 */
router.get('/users/:id', authenticate, requireAdmin, readLimiter, adminController.getUserById);

/**
 * PATCH /api/v1/admin/users/:id/role
 * Update user role
 * Admin or Super Admin only
 */
router.patch('/users/:id/role', authenticate, requireAdmin, writeLimiter, adminController.updateUserRole);

/**
 * POST /api/v1/admin/users/:id/activate
 * Activate a user account
 * Admin or Super Admin only
 */
router.post('/users/:id/activate', authenticate, requireAdmin, writeLimiter, adminController.activateUser);

/**
 * POST /api/v1/admin/users/:id/deactivate
 * Deactivate a user account
 * Admin or Super Admin only
 */
router.post(
  '/users/:id/deactivate',
  authenticate,
  requireAdmin,
  writeLimiter,
  adminController.deactivateUser
);

/**
 * DELETE /api/v1/admin/users/:id
 * Delete a user (permanent)
 * Super Admin only
 */
router.delete('/users/:id', authenticate, requireAdmin, writeLimiter, adminController.deleteUser);

// ============================================================================
// MENU MANAGEMENT ROUTES (Admin)
// ============================================================================

// CATEGORIES

/**
 * POST /api/v1/admin/menu/categories
 * Create a new category
 * Admin only
 */
router.post(
  '/menu/categories',
  authenticate,
  requireAdmin,
  writeLimiter,
  menuController.createCategory
);

/**
 * PUT /api/v1/admin/menu/categories/:categoryId
 * Update a category
 * Admin only
 */
router.put(
  '/menu/categories/:categoryId',
  authenticate,
  requireAdmin,
  writeLimiter,
  menuController.updateCategory
);

/**
 * DELETE /api/v1/admin/menu/categories/:categoryId
 * Delete a category (soft delete if has items)
 * Admin only
 */
router.delete(
  '/menu/categories/:categoryId',
  authenticate,
  requireAdmin,
  writeLimiter,
  menuController.deleteCategory
);

// MENU ITEMS

/**
 * POST /api/v1/admin/menu/items
 * Create a new menu item
 * Admin only
 */
router.post(
  '/menu/items',
  authenticate,
  requireAdmin,
  writeLimiter,
  menuController.createMenuItem
);

/**
 * PUT /api/v1/admin/menu/items/:itemId
 * Update a menu item
 * Admin only
 */
router.put(
  '/menu/items/:itemId',
  authenticate,
  requireAdmin,
  writeLimiter,
  menuController.updateMenuItem
);

/**
 * DELETE /api/v1/admin/menu/items/:itemId
 * Delete a menu item (soft delete)
 * Admin only
 */
router.delete(
  '/menu/items/:itemId',
  authenticate,
  requireAdmin,
  writeLimiter,
  menuController.deleteMenuItem
);

// MODIFIER GROUPS

/**
 * POST /api/v1/admin/menu/items/:itemId/modifier-groups
 * Create a new modifier group for a menu item
 * Admin only
 */
router.post(
  '/menu/items/:itemId/modifier-groups',
  authenticate,
  requireAdmin,
  writeLimiter,
  menuController.createModifierGroup
);

/**
 * PUT /api/v1/admin/menu/modifier-groups/:groupId
 * Update a modifier group
 * Admin only
 */
router.put(
  '/menu/modifier-groups/:groupId',
  authenticate,
  requireAdmin,
  writeLimiter,
  menuController.updateModifierGroup
);

/**
 * DELETE /api/v1/admin/menu/modifier-groups/:groupId
 * Delete a modifier group (hard delete, cascades to modifiers)
 * Admin only
 */
router.delete(
  '/menu/modifier-groups/:groupId',
  authenticate,
  requireAdmin,
  writeLimiter,
  menuController.deleteModifierGroup
);

// MODIFIERS

/**
 * POST /api/v1/admin/menu/modifier-groups/:groupId/modifiers
 * Create a new modifier for a modifier group
 * Admin only
 */
router.post(
  '/menu/modifier-groups/:groupId/modifiers',
  authenticate,
  requireAdmin,
  writeLimiter,
  menuController.createModifier
);

/**
 * PUT /api/v1/admin/menu/modifiers/:modifierId
 * Update a modifier
 * Admin only
 */
router.put(
  '/menu/modifiers/:modifierId',
  authenticate,
  requireAdmin,
  writeLimiter,
  menuController.updateModifier
);

/**
 * DELETE /api/v1/admin/menu/modifiers/:modifierId
 * Delete a modifier (hard delete)
 * Admin only
 */
router.delete(
  '/menu/modifiers/:modifierId',
  authenticate,
  requireAdmin,
  writeLimiter,
  menuController.deleteModifier
);

// ============================================================================
// IMAGE UPLOAD ROUTES (Admin)
// ============================================================================

/**
 * Mount upload routes
 * /api/v1/admin/upload/*
 *
 * Handles image uploads for menu items and categories
 * All routes require admin authentication
 */
router.use('/upload', uploadRoutes);

export default router;

/**
 * Admin Controller
 *
 * Handles HTTP requests for admin and staff operations.
 * Provides endpoints for order management, user management, and system settings.
 */

import { Response } from 'express';
import { AuthRequest, ApiResponse } from '@/models/common.model';
import * as orderService from '@/services/order.service';
import printService from '@/services/print.service';
import * as authService from '@/services/auth.service';
import { validate, updateOrderStatusSchema, orderQuerySchema } from '@/utils/validators';
import { asyncHandler } from '@/middleware/errorHandler';
import { UserRole } from '@prisma/client';

// ============================================================================
// ORDER MANAGEMENT
// ============================================================================

/**
 * Get all orders (staff/admin)
 * GET /api/v1/admin/orders
 */
export const getAllOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const query = validate(orderQuerySchema, req.query);

  const { page = 1, limit = 20, ...filters } = query;
  const offset = (page - 1) * limit;

  const orders = await orderService.getAllOrders(filters, limit, offset);

  const response: ApiResponse = {
    success: true,
    data: orders,
  };

  res.json(response);
});

/**
 * Update order status (staff/admin)
 * PATCH /api/v1/admin/orders/:id/status
 */
export const updateOrderStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = validate(updateOrderStatusSchema, req.body);

  if (!req.params.id!) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Order ID is required',
        code: 'VALIDATION_ERROR',
      },
    });
    return;
  }

  const order = await orderService.updateOrderStatus(
    req.params.id!,
    data.status,
    req.user!.id
  );

  // Print receipt when order is completed
  if (data.status === 'COMPLETED') {
    await printService.printReceipt(order);
  }

  const response: ApiResponse = {
    success: true,
    data: order,
    message: 'Order status updated successfully',
  };

  res.json(response);
});

/**
 * Get order statistics
 * GET /api/v1/admin/orders/stats
 */
export const getOrderStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const stats = await orderService.getOrderCountByStatus();

  const response: ApiResponse = {
    success: true,
    data: stats,
  };

  res.json(response);
});

/**
 * Refund an order (admin only)
 * POST /api/v1/admin/orders/:id/refund
 */
export const refundOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { amount } = req.body;

  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      },
    });
    return;
  }

  const result = await orderService.refundOrder(req.params.id!, req.user.id, amount);

  const response: ApiResponse = {
    success: true,
    data: result,
    message: 'Order refunded successfully',
  };

  res.json(response);
});

/**
 * Print kitchen ticket (staff)
 * POST /api/v1/admin/orders/:id/print-ticket
 */
export const printKitchenTicket = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.getOrderById(req.params.id!);
  const success = await printService.printKitchenTicket(order);

  const response: ApiResponse = {
    success: true,
    data: { printed: success },
    message: success ? 'Kitchen ticket sent to printer' : 'Failed to print ticket',
  };

  res.json(response);
});

/**
 * Print receipt (staff)
 * POST /api/v1/admin/orders/:id/print-receipt
 */
export const printReceipt = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.getOrderById(req.params.id!);
  const success = await printService.printReceipt(order);

  const response: ApiResponse = {
    success: true,
    data: { printed: success },
    message: success ? 'Receipt sent to printer' : 'Failed to print receipt',
  };

  res.json(response);
});

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Get all users (admin only)
 * GET /api/v1/admin/users
 */
export const getAllUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const filters = {
    role: req.query.role as UserRole | undefined,
    isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
    search: req.query.search as string | undefined,
  };

  const users = await authService.getAllUsers(filters);

  const response: ApiResponse = {
    success: true,
    data: users,
  };

  res.json(response);
});

/**
 * Get user by ID (admin only)
 * GET /api/v1/admin/users/:id
 */
export const getUserById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.getUserById(req.params.id!);

  const response: ApiResponse = {
    success: true,
    data: user,
  };

  res.json(response);
});

/**
 * Update user role (admin only)
 * PATCH /api/v1/admin/users/:id/role
 */
export const updateUserRole = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { role } = req.body;

  if (!Object.values(UserRole).includes(role)) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Invalid role',
        code: 'VALIDATION_ERROR',
      },
    });
    return;
  }

  const user = await authService.updateUserRole(req.params.id!, role as UserRole);

  const response: ApiResponse = {
    success: true,
    data: user,
    message: 'User role updated successfully',
  };

  res.json(response);
});

/**
 * Activate user (admin only)
 * POST /api/v1/admin/users/:id/activate
 */
export const activateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.activateUser(req.params.id!);

  const response: ApiResponse = {
    success: true,
    data: user,
    message: 'User activated successfully',
  };

  res.json(response);
});

/**
 * Deactivate user (admin only)
 * POST /api/v1/admin/users/:id/deactivate
 */
export const deactivateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await authService.deactivateUser(req.params.id!);

  const response: ApiResponse = {
    success: true,
    data: user,
    message: 'User deactivated successfully',
  };

  res.json(response);
});

/**
 * Delete user (super admin only)
 * DELETE /api/v1/admin/users/:id
 */
export const deleteUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  await authService.deleteUser(req.params.id!);

  const response: ApiResponse = {
    success: true,
    data: null,
    message: 'User deleted successfully',
  };

  res.json(response);
});

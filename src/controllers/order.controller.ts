/**
 * Order Controller
 *
 * HTTP handlers for order processing endpoints.
 * Customer endpoints for creating and viewing orders
 * Admin endpoints for order management and refunds.
 */

import { Request, Response } from 'express';
import * as orderService from '@/services/order.service';
import logger from '@/utils/logger';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  refundOrderSchema,
} from '@/utils/validators';
import { OrderStatus } from '@prisma/client';

// ============================================================================
// CUSTOMER ENDPOINTS
// ============================================================================

/**
 * Create order
 * POST /api/v1/orders
 *
 * Creates order with payment processing
 */
export async function createOrder(req: Request, res: Response): Promise<void> {
  try {
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

    const validationResult = createOrderSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.errors,
        },
      });
      return;
    }

    const order = await orderService.createOrder(req.user.id, validationResult.data);

    logger.info('Order created', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: { order },
      message: 'Order created successfully',
    });
  } catch (error) {
    logger.error('Create order error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to create order',
        code: 'CREATE_ORDER_ERROR',
      },
    });
  }
}

/**
 * Get user orders with pagination
 * GET /api/v1/orders?page=1&limit=10&status=PREPARING
 *
 * Lists authenticated user's orders
 */
export async function getUserOrders(req: Request, res: Response): Promise<void> {
  try {
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

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as OrderStatus | undefined;

    const result = await orderService.getUserOrders(req.user.id, page, limit, status);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Get user orders error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch orders',
        code: 'FETCH_ERROR',
      },
    });
  }
}

/**
 * Get order by ID
 * GET /api/v1/orders/:orderId
 *
 * Returns order details (only accessible by owner or admin)
 */
export async function getOrderById(req: Request, res: Response): Promise<void> {
  try {
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

    const { orderId } = req.params;

    const isAdmin = req.user.role === 'ADMIN';
    const order = await orderService.getOrderById(orderId, isAdmin ? undefined : req.user.id);

    if (!order) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { order },
    });
  } catch (error) {
    logger.error('Get order error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch order',
        code: 'FETCH_ERROR',
      },
    });
  }
}

/**
 * Get order status (lightweight)
 * GET /api/v1/orders/:orderId/status
 *
 * Returns only status for polling
 */
export async function getOrderStatus(req: Request, res: Response): Promise<void> {
  try {
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

    const { orderId } = req.params;

    const isAdmin = req.user.role === 'ADMIN';
    const order = await orderService.getOrderById(orderId, isAdmin ? undefined : req.user.id);

    if (!order) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        status: order.status,
        estimatedReadyTime: order.estimatedReadyTime,
        actualReadyTime: order.actualReadyTime,
      },
    });
  } catch (error) {
    logger.error('Get order status error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch order status',
        code: 'FETCH_ERROR',
      },
    });
  }
}

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

/**
 * Get all orders (admin)
 * GET /api/v1/admin/orders?status=PREPARING&date=2024-01-15&page=1&limit=10
 *
 * Lists all orders with filters
 */
export async function getAllOrders(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as OrderStatus | undefined;
    const date = req.query.date as string | undefined;

    const result = await orderService.getAllOrders(
      { status, date },
      page,
      limit
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Get all orders error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch orders',
        code: 'FETCH_ERROR',
      },
    });
  }
}

/**
 * Get active orders (admin)
 * GET /api/v1/admin/orders/active
 *
 * Returns non-completed orders for kitchen display
 * Sorted by createdAt asc (oldest first)
 */
export async function getActiveOrders(req: Request, res: Response): Promise<void> {
  try {
    const orders = await orderService.getActiveOrders();

    res.status(200).json({
      success: true,
      data: { orders },
    });
  } catch (error) {
    logger.error('Get active orders error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch active orders',
        code: 'FETCH_ERROR',
      },
    });
  }
}

/**
 * Update order status (admin)
 * PUT /api/v1/admin/orders/:orderId/status
 *
 * Updates order status with validation
 */
export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  try {
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

    const { orderId } = req.params;

    const validationResult = updateOrderStatusSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.errors,
        },
      });
      return;
    }

    const order = await orderService.updateOrderStatus(
      orderId,
      validationResult.data.status,
      req.user.id
    );

    logger.info('Order status updated by admin', {
      orderId,
      newStatus: validationResult.data.status,
      adminId: req.user.id,
    });

    res.status(200).json({
      success: true,
      data: { order },
      message: 'Order status updated successfully',
    });
  } catch (error) {
    logger.error('Update order status error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND',
        },
      });
      return;
    }

    if (error instanceof Error && error.message.includes('transition')) {
      res.status(400).json({
        success: false,
        error: {
          message: error.message,
          code: 'INVALID_STATUS_TRANSITION',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update order status',
        code: 'UPDATE_ERROR',
      },
    });
  }
}

/**
 * Refund order (admin)
 * POST /api/v1/admin/orders/:orderId/refund
 *
 * Refunds order (full or partial)
 */
export async function refundOrder(req: Request, res: Response): Promise<void> {
  try {
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

    const { orderId } = req.params;

    const validationResult = refundOrderSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.errors,
        },
      });
      return;
    }

    const result = await orderService.refundOrder(
      orderId,
      req.user.id,
      validationResult.data.amount
    );

    logger.info('Order refunded by admin', {
      orderId,
      amount: validationResult.data.amount,
      adminId: req.user.id,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: 'Order refunded successfully',
    });
  } catch (error) {
    logger.error('Refund order error:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Order not found',
            code: 'ORDER_NOT_FOUND',
          },
        });
        return;
      }

      if (error.message.includes('already refunded')) {
        res.status(400).json({
          success: false,
          error: {
            message: error.message,
            code: 'ALREADY_REFUNDED',
          },
        });
        return;
      }

      if (error.message.includes('exceeds')) {
        res.status(400).json({
          success: false,
          error: {
            message: error.message,
            code: 'INVALID_REFUND_AMOUNT',
          },
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to refund order',
        code: 'REFUND_ERROR',
      },
    });
  }
}

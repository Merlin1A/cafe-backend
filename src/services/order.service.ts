/**
 * Order Service
 *
 * Handles order processing including:
 * - Order validation and creation
 * - Payment processing with Stripe
 * - Order totals calculation
 * - Print job creation
 * - Order status management
 */

import { prisma } from '@/config/database';
import logger from '@/utils/logger';
import { OrderStatus, PaymentStatus, PrinterDestination } from '@prisma/client';
import paymentService from '@/services/payment.service';
import printService from '@/services/print.service';

// Constants
const TAX_RATE = 0.0635; // Connecticut 6.35%
const BASE_PREP_TIME_MINUTES = 5;
const TIME_PER_5_ITEMS = 2;
const TIME_ROUNDING = 5;

// ============================================================================
// TYPES
// ============================================================================

export interface OrderItemInput {
  menuItemId: string;
  quantity: number;
  selectedModifiers?: string[];
  specialInstructions?: string;
}

export interface CreateOrderDTO {
  items: OrderItemInput[];
  specialInstructions?: string;
  paymentMethodId: string;
}

export interface ValidatedOrderItem {
  menuItem: {
    id: string;
    name: string;
    basePrice: number;
    preparationTime: number;
    printerDestination: PrinterDestination;
  };
  quantity: number;
  modifiers: {
    id: string;
    name: string;
    priceAdjustment: number;
  }[];
  specialInstructions?: string;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderTotals {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

// ============================================================================
// ORDER CREATION
// ============================================================================

/**
 * Create a new order with payment processing
 *
 * Flow:
 * 1. Validate items and modifiers
 * 2. Calculate totals
 * 3. Create and confirm Stripe PaymentIntent
 * 4. Save order to database (transaction)
 * 5. Create print jobs
 * 6. Return order confirmation
 */
export async function createOrder(
  userId: string,
  data: CreateOrderDTO
): Promise<any> {
  let paymentIntentId: string | null = null;
  let tempOrderId: string | null = null;

  try {
    // Step 1: Validate order items
    logger.info('Validating order items', { userId, itemCount: data.items.length });
    const validatedItems = await validateOrderItems(data.items);

    // Step 2: Calculate totals
    const totals = calculateOrderTotals(validatedItems);
    logger.info('Order totals calculated', { ...totals });

    // Step 3: Calculate estimated ready time
    const estimatedReadyTime = await generateEstimatedReadyTime(validatedItems);

    // Step 4: Create temporary order record to get orderId
    const tempOrder = await prisma.order.create({
      data: {
        userId,
        status: OrderStatus.PENDING,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        paymentStatus: PaymentStatus.PENDING,
        specialInstructions: data.specialInstructions,
        estimatedReadyTime,
        orderItems: {
          create: validatedItems.map((item) => ({
            menuItemId: item.menuItem.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            specialInstructions: item.specialInstructions,
            selectedModifiers: {
              create: item.modifiers.map((modifier) => ({
                modifierId: modifier.id,
                modifierName: modifier.name,
                priceAdjustment: modifier.priceAdjustment,
              })),
            },
          })),
        },
      },
    });

    tempOrderId = tempOrder.id;

    // Step 5: Create PaymentIntent with amount in cents and orderId
    const amountInCents = Math.round(totals.totalAmount * 100);
    logger.info('Creating Stripe PaymentIntent', { amountInCents, orderId: tempOrderId });

    const paymentIntent = await paymentService.createPaymentIntent(
      amountInCents,
      'usd',
      { userId, orderId: tempOrderId }
    );

    paymentIntentId = paymentIntent.id;

    // Step 6: Confirm payment with payment method
    logger.info('Confirming payment', { paymentIntentId });
    const confirmedPayment = await paymentService.confirmPayment(
      paymentIntentId,
      data.paymentMethodId
    );

    // Step 7: Check payment status
    if (confirmedPayment.status !== 'succeeded') {
      throw new Error(`Payment failed: ${confirmedPayment.status}`);
    }

    logger.info('Payment successful', {
      paymentIntentId: confirmedPayment.id,
      amount: totals.totalAmount,
    });

    // Step 8: Update order with payment details in transaction
    const order = await prisma.$transaction(async (tx) => {
      // Update order with payment info and confirmed status
      const updatedOrder = await tx.order.update({
        where: { id: tempOrderId! },
        data: {
          status: OrderStatus.CONFIRMED,
          stripePaymentIntentId: paymentIntentId!,
          paymentStatus: PaymentStatus.PAID,
        },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          orderItems: {
            include: {
              menuItem: {
                select: {
                  name: true,
                  printerDestination: true,
                  preparationTime: true,
                },
              },
              selectedModifiers: {
                select: {
                  modifierName: true,
                },
              },
            },
          },
        },
      });

      return updatedOrder;
    });

    // Step 9: Create print jobs outside transaction
    // (so they can be retried independently if they fail)
    try {
      await printService.createPrintJobs(order);
    } catch (printError) {
      logger.error('Failed to create print jobs, order will proceed', {
        orderId: order.id,
        error: printError,
      });
      // Don't fail the order if print jobs fail
    }

    logger.info('Order created successfully', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId,
      totalAmount: order.totalAmount,
    });

    return order;
  } catch (error) {
    logger.error('Failed to create order:', error);

    // If we have a payment intent and payment succeeded, refund it
    // (This happens if database save fails after payment succeeds)
    if (paymentIntentId) {
      try {
        logger.warn('Database save failed after payment, initiating refund', { paymentIntentId });
        await paymentService.refundPayment(paymentIntentId);
        logger.info('Payment refunded successfully', { paymentIntentId });
      } catch (refundError) {
        logger.error('Failed to refund payment after order creation failure', {
          paymentIntentId,
          refundError,
        });
      }
    }

    // Clean up temporary order if it was created
    if (tempOrderId && !paymentIntentId) {
      try {
        await prisma.order.delete({ where: { id: tempOrderId } });
        logger.info('Cleaned up temporary order', { tempOrderId });
      } catch (cleanupError) {
        logger.error('Failed to clean up temporary order', { tempOrderId, cleanupError });
      }
    }

    throw error;
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate order items and modifier selections
 *
 * - Checks if menu items exist and are available
 * - Validates modifier selections against modifier groups
 * - Calculates prices including modifiers
 */
export async function validateOrderItems(
  items: OrderItemInput[]
): Promise<ValidatedOrderItem[]> {
  const validatedItems: ValidatedOrderItem[] = [];

  for (const item of items) {
    // Fetch menu item with modifier groups
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: item.menuItemId },
      include: {
        modifierGroups: {
          include: {
            modifiers: {
              where: { isAvailable: true },
            },
          },
        },
      },
    });

    if (!menuItem) {
      throw new Error(`Menu item not found: ${item.menuItemId}`);
    }

    if (!menuItem.isAvailable) {
      throw new Error(`Menu item not available: ${menuItem.name}`);
    }

    // Validate and fetch selected modifiers
    const selectedModifiers = [];
    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      for (const modifierId of item.selectedModifiers) {
        const modifier = await prisma.modifier.findUnique({
          where: { id: modifierId },
          include: {
            modifierGroup: true,
          },
        });

        if (!modifier) {
          throw new Error(`Modifier not found: ${modifierId}`);
        }

        if (!modifier.isAvailable) {
          throw new Error(`Modifier not available: ${modifier.name}`);
        }

        // Check if modifier belongs to this menu item
        const belongsToItem = menuItem.modifierGroups.some(
          (group) => group.id === modifier.modifierGroupId
        );

        if (!belongsToItem) {
          throw new Error(
            `Modifier ${modifier.name} does not belong to ${menuItem.name}`
          );
        }

        selectedModifiers.push({
          id: modifier.id,
          name: modifier.name,
          priceAdjustment: Number(modifier.priceAdjustment),
        });
      }

      // Validate modifier group constraints
      for (const group of menuItem.modifierGroups) {
        const groupModifiers = selectedModifiers.filter((m) =>
          group.modifiers.some((gm) => gm.id === m.id)
        );

        // Check minimum selections
        if (group.isRequired && group.minSelections > 0) {
          if (groupModifiers.length < group.minSelections) {
            throw new Error(
              `${group.name} requires at least ${group.minSelections} selection(s)`
            );
          }
        }

        // Check maximum selections
        if (group.maxSelections !== null && groupModifiers.length > group.maxSelections) {
          throw new Error(
            `${group.name} allows maximum ${group.maxSelections} selection(s)`
          );
        }
      }
    }

    // Calculate item price
    const unitPrice = calculateItemPrice(
      Number(menuItem.basePrice),
      selectedModifiers
    );
    const totalPrice = unitPrice * item.quantity;

    validatedItems.push({
      menuItem: {
        id: menuItem.id,
        name: menuItem.name,
        basePrice: Number(menuItem.basePrice),
        preparationTime: menuItem.preparationTime,
        printerDestination: menuItem.printerDestination,
      },
      quantity: item.quantity,
      modifiers: selectedModifiers,
      specialInstructions: item.specialInstructions,
      unitPrice,
      totalPrice,
    });
  }

  return validatedItems;
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Calculate order totals
 *
 * - Subtotal = sum of all item prices
 * - Tax = subtotal * 0.0635
 * - Total = subtotal + tax
 */
export function calculateOrderTotals(items: ValidatedOrderItem[]): OrderTotals {
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const taxAmount = Math.round(subtotal * TAX_RATE * 100) / 100; // Round to 2 decimals
  const totalAmount = subtotal + taxAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/**
 * Calculate item price including modifiers
 *
 * Price = basePrice + sum(modifier.priceAdjustment)
 */
function calculateItemPrice(
  basePrice: number,
  modifiers: { priceAdjustment: number }[]
): number {
  const modifierTotal = modifiers.reduce(
    (sum, modifier) => sum + modifier.priceAdjustment,
    0
  );
  return Math.round((basePrice + modifierTotal) * 100) / 100;
}

/**
 * Generate estimated ready time
 *
 * - Base: 5 minutes
 * - Add: max(preparationTime) of all items
 * - Add: 2 minutes per 5 items currently in queue (CONFIRMED or PREPARING)
 * - Round up to nearest 5 minutes
 */
async function generateEstimatedReadyTime(
  items: ValidatedOrderItem[]
): Promise<Date> {
  let totalMinutes = BASE_PREP_TIME_MINUTES;

  if (items.length > 0) {
    const maxPrepTime = Math.max(...items.map((item) => item.menuItem.preparationTime));
    totalMinutes += maxPrepTime;
  }

  // Count items in queue (parallel queries)
  const [, queuedItems] = await Promise.all([
    prisma.order.count({
      where: {
        status: {
          in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING],
        },
      },
    }),
    prisma.orderItem.count({
      where: {
        order: {
          status: {
            in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING],
          },
        },
      },
    }),
  ]);

  // Add 2 minutes per 5 items in queue
  const queueDelay = Math.floor(queuedItems / 5) * TIME_PER_5_ITEMS;
  totalMinutes += queueDelay;

  // Round up to nearest 5 minutes
  totalMinutes = Math.ceil(totalMinutes / TIME_ROUNDING) * TIME_ROUNDING;

  // Create estimated ready time
  const estimatedReadyTime = new Date();
  estimatedReadyTime.setMinutes(estimatedReadyTime.getMinutes() + totalMinutes);

  return estimatedReadyTime;
}

// ============================================================================
// PRINT JOBS
// ============================================================================
// Note: Print job creation moved to print.service.ts
// Jobs are created with receipt data after order confirmation

// ============================================================================
// ORDER RETRIEVAL
// ============================================================================

/**
 * Get order by ID
 *
 * @param orderId - Order UUID
 * @param userId - Optional user ID for access control
 * @returns Order with items or null
 */
export async function getOrderById(
  orderId: string,
  userId?: string
): Promise<any | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      orderItems: {
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
          selectedModifiers: true,
        },
      },
    },
  });

  if (!order) {
    return null;
  }

  // Check access control (user can only see their own orders unless admin)
  if (userId && order.userId !== userId) {
    return null;
  }

  return order;
}

/**
 * Get user's orders with pagination
 *
 * @param userId - User UUID
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @param status - Optional status filter
 * @returns Paginated orders
 */
export async function getUserOrders(
  userId: string,
  page: number = 1,
  limit: number = 10,
  status?: OrderStatus
): Promise<{ orders: any[]; total: number; page: number; limit: number }> {
  const skip = (page - 1) * limit;

  const where: any = { userId };
  if (status) {
    where.status = status;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
            selectedModifiers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    total,
    page,
    limit,
  };
}

// ============================================================================
// ORDER STATUS MANAGEMENT
// ============================================================================

/**
 * Valid order status transitions
 */
const VALID_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

/**
 * Update order status
 *
 * @param orderId - Order UUID
 * @param newStatus - New status
 * @param adminId - Admin user ID
 * @returns Updated order
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  adminId: string
): Promise<any> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  // Validate status transition
  const allowedTransitions = VALID_STATUS_TRANSITIONS[order.status];
  if (!allowedTransitions.includes(newStatus)) {
    throw new Error(
      `Invalid status transition from ${order.status} to ${newStatus}`
    );
  }

  // Handle cancelled status (trigger refund)
  if (newStatus === OrderStatus.CANCELLED && order.paymentStatus === PaymentStatus.PAID) {
    await refundOrder(orderId, adminId);
  }

  // Update order status
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: newStatus,
      ...(newStatus === OrderStatus.READY && { actualReadyTime: new Date() }),
    },
    include: {
      orderItems: {
        include: {
          menuItem: true,
          selectedModifiers: true,
        },
      },
    },
  });

  logger.info('Order status updated', {
    orderId,
    oldStatus: order.status,
    newStatus,
    adminId,
  });

  return updatedOrder;
}

/**
 * Get active orders (for kitchen display)
 *
 * Returns orders with status CONFIRMED or PREPARING
 * Sorted by createdAt asc (oldest first)
 */
export async function getActiveOrders(): Promise<any[]> {
  const orders = await prisma.order.findMany({
    where: {
      status: {
        in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING],
      },
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      orderItems: {
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
              printerDestination: true,
            },
          },
          selectedModifiers: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });

  return orders;
}

/**
 * Get all orders with filters (admin only)
 *
 * @param filters - Status and date filters
 * @param page - Page number
 * @param limit - Items per page
 * @returns Paginated orders
 */
export async function getAllOrders(
  filters: { status?: OrderStatus; date?: string },
  page: number = 1,
  limit: number = 10
): Promise<{ orders: any[]; total: number; page: number; limit: number }> {
  const skip = (page - 1) * limit;

  const where: any = {};
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.date) {
    const startOfDay = new Date(filters.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(filters.date);
    endOfDay.setHours(23, 59, 59, 999);

    where.createdAt = {
      gte: startOfDay,
      lte: endOfDay,
    };
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        orderItems: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
              },
            },
            selectedModifiers: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders,
    total,
    page,
    limit,
  };
}

// ============================================================================
// REFUNDS
// ============================================================================

/**
 * Refund an order
 *
 * @param orderId - Order UUID
 * @param adminId - Admin user ID
 * @param amount - Optional partial refund amount (omit for full refund)
 * @returns Refund details
 */
export async function refundOrder(
  orderId: string,
  adminId: string,
  amount?: number
): Promise<any> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (!order.stripePaymentIntentId) {
    throw new Error('No payment to refund');
  }

  if (order.paymentStatus === PaymentStatus.REFUNDED) {
    throw new Error('Order already refunded');
  }

  // Calculate refund amount
  const refundAmount = amount || Number(order.totalAmount);

  if (refundAmount > Number(order.totalAmount)) {
    throw new Error('Refund amount exceeds order total');
  }

  // Create Stripe refund through payment service
  const refund = await paymentService.refundPayment(
    order.stripePaymentIntentId,
    Math.round(refundAmount * 100), // Convert to cents
    `Refund for order ${order.orderNumber} by admin ${adminId}`
  );

  // Update order status
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: PaymentStatus.REFUNDED,
      status: OrderStatus.CANCELLED,
    },
  });

  logger.info('Order refunded', {
    orderId,
    refundAmount,
    refundId: refund.id,
    adminId,
  });

  return {
    refund,
    order: updatedOrder,
  };
}

/**
 * Get order count by status
 * Returns statistics about orders grouped by status
 *
 * @returns Order counts by status
 */
export async function getOrderCountByStatus(): Promise<Record<string, number>> {
  try {
    const counts = await prisma.order.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    const stats: Record<string, number> = {};
    counts.forEach((item) => {
      stats[item.status] = item._count.id;
    });

    logger.debug('Order count by status retrieved', { stats });

    return stats;
  } catch (error) {
    logger.error('Failed to get order count by status', { error });
    throw error;
  }
}

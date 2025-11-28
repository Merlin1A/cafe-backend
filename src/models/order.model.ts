/**
 * Order Model Types
 *
 * Types and interfaces for order-related data structures.
 */

import {
  Order,
  OrderItem,
  OrderItemModifier,
  OrderStatus,
  PaymentStatus,
  MenuItem,
  User,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// ENUMS (Not in Prisma schema, defined locally)
// ============================================================================

export enum FulfillmentType {
  PICKUP = 'PICKUP',
  DINE_IN = 'DINE_IN',
}

export enum PaymentMethod {
  CARD = 'CARD',
  APPLE_PAY = 'APPLE_PAY',
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: OrderStatus;
  changedAt: Date;
  changedBy?: string;
}

// ============================================================================
// ORDER TYPES
// ============================================================================

/**
 * Order item modifier data for creating an order
 */
export interface CreateOrderItemModifierData {
  modifierId: string;
  modifierName: string;
  priceAdjustment: number | Decimal;
}

/**
 * Order item data for creating an order
 */
export interface CreateOrderItemData {
  menuItemId: string;
  quantity: number;
  modifiers?: CreateOrderItemModifierData[];
  specialInstructions?: string;
}

/**
 * Order creation data
 */
export interface CreateOrderData {
  userId: string;
  items: CreateOrderItemData[];
  fulfillmentType: FulfillmentType;
  scheduledFor?: Date | string;
  paymentMethod: PaymentMethod;
  tip?: number | Decimal;
  notes?: string;
}

/**
 * Calculated order pricing
 */
export interface OrderPricing {
  subtotal: Decimal;
  tax: Decimal;
  tip: Decimal;
  total: Decimal;
}

/**
 * Order with full item details
 */
export interface OrderItemWithModifiers extends OrderItem {
  modifiers: OrderItemModifier[];
  menuItem: MenuItem;
}

/**
 * Order with all relations
 */
export interface OrderWithRelations extends Order {
  user: User;
  items: OrderItemWithModifiers[];
  statusHistory?: OrderStatusHistory[];
}

/**
 * Order update data
 */
export interface UpdateOrderData {
  status?: OrderStatus;
  scheduledFor?: Date | string;
  notes?: string;
  completedAt?: Date;
  cancelledAt?: Date;
}

/**
 * Order status update data
 */
export interface UpdateOrderStatusData {
  status: OrderStatus;
  notes?: string;
  changedBy?: string;
}

/**
 * Order query filters
 */
export interface OrderFilters {
  userId?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  fulfillmentType?: FulfillmentType;
  startDate?: Date | string;
  endDate?: Date | string;
}

/**
 * Order statistics
 */
export interface OrderStats {
  totalOrders: number;
  totalRevenue: Decimal;
  averageOrderValue: Decimal;
  ordersByStatus: Record<OrderStatus, number>;
  ordersByPaymentMethod: Record<PaymentMethod, number>;
}

// ============================================================================
// PAYMENT TYPES
// ============================================================================

/**
 * Payment intent creation data
 */
export interface CreatePaymentIntentData {
  amount: number; // Amount in cents
  currency?: string;
  metadata?: Record<string, string>;
}

/**
 * Payment result
 */
export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  clientSecret?: string;
  error?: string;
}

/**
 * Refund data
 */
export interface CreateRefundData {
  paymentIntentId: string;
  amount?: number; // Amount in cents, if partial refund
  reason?: string;
}

/**
 * Refund result
 */
export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  error?: string;
}

// ============================================================================
// PRINT/RECEIPT TYPES
// ============================================================================

/**
 * Receipt data for printing
 */
export interface ReceiptData {
  orderNumber: string;
  orderDate: Date;
  customerName?: string;
  items: {
    name: string;
    quantity: number;
    price: Decimal;
    modifiers?: string[];
    specialInstructions?: string;
  }[];
  subtotal: Decimal;
  tax: Decimal;
  tip: Decimal;
  total: Decimal;
  paymentMethod: PaymentMethod;
  fulfillmentType: FulfillmentType;
}

/**
 * Kitchen ticket data
 */
export interface KitchenTicketData {
  orderNumber: string;
  orderTime: Date;
  scheduledFor?: Date;
  items: {
    name: string;
    quantity: number;
    modifiers?: string[];
    specialInstructions?: string;
  }[];
  notes?: string;
}

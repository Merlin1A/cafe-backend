/**
 * Request Validation Schemas using Zod
 *
 * Provides type-safe request validation for API endpoints.
 * All validators throw detailed error messages for invalid input.
 */

import { z } from 'zod';

// ============================================================================
// AUTHENTICATION VALIDATORS
// ============================================================================

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  photoUrl: z.string().url().optional(),
});

// ============================================================================
// MENU VALIDATORS
// ============================================================================

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100, 'Category name must not exceed 100 characters'),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  displayOrder: z.number().int('Display order must be an integer').optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
  isActive: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createMenuItemSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  name: z.string().min(1, 'Item name is required').max(100, 'Item name must not exceed 100 characters'),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  basePrice: z.number().positive('Base price must be positive'),
  preparationTime: z.number().int().positive('Preparation time must be a positive integer').optional(),
  calories: z.number().int().positive('Calories must be a positive integer').optional(),
  allergens: z.array(z.string()).optional(),
  printerDestination: z.enum(['KITCHEN', 'BEVERAGE', 'BOTH'], {
    errorMap: () => ({ message: 'Printer destination must be KITCHEN, BEVERAGE, or BOTH' })
  }).optional(),
  imageUrl: z.string().url('Invalid image URL').optional(),
  thumbnailUrl: z.string().url('Invalid thumbnail URL').optional(),
  isAvailable: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export const updateMenuItemSchema = createMenuItemSchema.partial();

export const createModifierGroupSchema = z.object({
  name: z.string().min(1, 'Modifier group name is required').max(100, 'Modifier group name must not exceed 100 characters'),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  isRequired: z.boolean().optional(),
  minSelections: z.number().int().min(0, 'Minimum selections must be >= 0').optional(),
  maxSelections: z.number().int().min(1, 'Maximum selections must be >= 1').nullable().optional(),
  displayOrder: z.number().int().optional(),
});

export const updateModifierGroupSchema = createModifierGroupSchema.partial();

export const createModifierSchema = z.object({
  name: z.string().min(1, 'Modifier name is required').max(100, 'Modifier name must not exceed 100 characters'),
  priceAdjustment: z.number().optional(),
  isDefault: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
});

export const updateModifierSchema = createModifierSchema.partial();

// ============================================================================
// ORDER VALIDATORS
// ============================================================================

export const orderItemSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(20, 'Quantity cannot exceed 20'),
  selectedModifiers: z.array(z.string().uuid('Invalid modifier ID')).optional(),
  specialInstructions: z.string().max(200, 'Special instructions must not exceed 200 characters').optional(),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'Order must contain at least one item'),
  specialInstructions: z.string().max(500, 'Special instructions must not exceed 500 characters').optional(),
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY',
    'COMPLETED',
    'CANCELLED',
  ], {
    errorMap: () => ({ message: 'Invalid order status' })
  }),
});

export const refundOrderSchema = z.object({
  amount: z.number().positive('Refund amount must be positive').optional(),
});

// ============================================================================
// USER ADDRESS VALIDATORS
// ============================================================================

export const createAddressSchema = z.object({
  label: z.string().min(1, 'Address label is required'),
  street: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2, 'State must be 2 characters'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = createAddressSchema.partial();

// ============================================================================
// QUERY PARAMETER VALIDATORS
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const menuQuerySchema = paginationSchema.extend({
  categoryId: z.string().cuid().optional(),
  search: z.string().optional(),
  isAvailable: z.coerce.boolean().optional(),
  sortBy: z.enum(['name', 'price', 'createdAt', 'sortOrder']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const orderQuerySchema = paginationSchema.extend({
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY',
    'COMPLETED',
    'CANCELLED',
  ]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ============================================================================
// SYSTEM VALIDATORS
// ============================================================================

export const systemSettingSchema = z.object({
  key: z.string().min(1, 'Setting key is required'),
  value: z.string(),
  description: z.string().optional(),
});

// ============================================================================
// HELPER FUNCTION
// ============================================================================

/**
 * Validates data against a Zod schema
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and typed data
 * @throws ZodError if validation fails
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validates data and returns result with errors
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Object with success flag and data or error
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

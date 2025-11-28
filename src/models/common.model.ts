/**
 * Common Types and Interfaces
 *
 * Shared types used across the application.
 */

import { Request } from 'express';
import { AuthenticatedUser } from './user.model';

// ============================================================================
// REQUEST TYPES
// ============================================================================

/**
 * Authenticated request with Firebase user information
 */
export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Standard API success response
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Standard API error response
 */
export interface ApiError {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

export class PaymentError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 402, 'PAYMENT_ERROR', details);
    this.name = 'PaymentError';
  }
}

// ============================================================================
// FIREBASE TYPES
// ============================================================================

export interface FirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
}

// ============================================================================
// FILE UPLOAD TYPES
// ============================================================================

export interface UploadedFile {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
}

// ============================================================================
// SYSTEM SETTING TYPES
// ============================================================================

export interface SystemSettingKey {
  TAX_RATE: string;
  STORE_OPEN_TIME: string;
  STORE_CLOSE_TIME: string;
  MIN_ORDER_AMOUNT: string;
  MAX_ORDER_ITEMS: string;
  ORDER_PREP_TIME: string;
}

export const SYSTEM_SETTINGS: Record<keyof SystemSettingKey, string> = {
  TAX_RATE: 'tax_rate',
  STORE_OPEN_TIME: 'store_open_time',
  STORE_CLOSE_TIME: 'store_close_time',
  MIN_ORDER_AMOUNT: 'min_order_amount',
  MAX_ORDER_ITEMS: 'max_order_items',
  ORDER_PREP_TIME: 'order_prep_time',
};

/**
 * Rate Limiting Middleware
 *
 * Protects API endpoints from abuse using express-rate-limit.
 * Different rate limits for different endpoint types.
 */

import rateLimit from 'express-rate-limit';
import { config } from '@/config';

/**
 * Standard rate limiter for general API endpoints
 * Default: 100 requests per 15 minutes
 */
export const standardLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip rate limiting in test environment
  skip: () => config.isTest,
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks
 * 10 requests per minute
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts, please try again later',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
});

/**
 * Relaxed rate limiter for read operations
 * 200 requests per 15 minutes
 */
export const readLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 200,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
});

/**
 * Strict rate limiter for write operations
 * 30 requests per 15 minutes
 */
export const writeLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 30,
  message: {
    success: false,
    error: {
      message: 'Too many write operations, please try again later',
      code: 'WRITE_RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
});

/**
 * Very strict rate limiter for file uploads
 * 10 uploads per hour
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    error: {
      message: 'Upload limit exceeded, please try again later',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
});

/**
 * Rate limiter for order creation
 * Prevents spam orders
 * 5 requests per minute
 */
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    success: false,
    error: {
      message: 'Order limit exceeded, please try again later',
      code: 'ORDER_RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
});

/**
 * Custom rate limiter factory
 * Creates a rate limiter with custom options
 */
export function createRateLimiter(options: {
  windowMs?: number;
  max?: number;
  message?: string;
}) {
  return rateLimit({
    windowMs: options.windowMs || config.rateLimit.windowMs,
    max: options.max || config.rateLimit.maxRequests,
    message: {
      success: false,
      error: {
        message: options.message || 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.isTest,
  });
}

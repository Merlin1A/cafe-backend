/**
 * Error Handler Middleware
 *
 * Global error handling for Express application.
 * Catches and formats all errors with appropriate HTTP status codes.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, ApiError } from '@/models/common.model';
import logger from '@/utils/logger';
import { config } from '@/config';

/**
 * Format Zod validation errors
 */
function formatZodError(error: ZodError): { message: string; details: unknown } {
  const errors = error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  return {
    message: 'Validation failed',
    details: errors,
  };
}

/**
 * Format Prisma errors
 */
function formatPrismaError(error: Prisma.PrismaClientKnownRequestError): {
  message: string;
  statusCode: number;
} {
  switch (error.code) {
    case 'P2002':
      // Unique constraint violation
      return {
        message: 'A record with this value already exists',
        statusCode: 409,
      };
    case 'P2025':
      // Record not found
      return {
        message: 'Record not found',
        statusCode: 404,
      };
    case 'P2003':
      // Foreign key constraint violation
      return {
        message: 'Related record not found',
        statusCode: 400,
      };
    case 'P2014':
      // Invalid ID
      return {
        message: 'Invalid ID provided',
        statusCode: 400,
      };
    default:
      return {
        message: 'Database operation failed',
        statusCode: 500,
      };
  }
}

/**
 * Error handler middleware
 * Logs full error internally but returns safe messages to client
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const sanitizeForLogging = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized = { ...obj };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'paymentMethodId', 'cardNumber', 'cvv', 'cvc'];
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    return sanitized;
  };

  logger.error('Error occurred:', {
    error: err.message,
    stack: config.isDevelopment ? err.stack : undefined,
    path: req.path,
    method: req.method,
    ip: req.ip,
    body: sanitizeForLogging(req.body),
    query: sanitizeForLogging(req.query),
    params: req.params,
    user: (req as any).user?.id,
  });

  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';
  let code: string | undefined;
  let details: unknown;

  // Handle different error types
  if (err instanceof AppError) {
    // Custom application errors
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    details = err.details;
  } else if (err instanceof ZodError) {
    // Zod validation errors
    statusCode = 400;
    const formatted = formatZodError(err);
    message = formatted.message;
    details = formatted.details;
    code = 'VALIDATION_ERROR';
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Prisma errors - use safe messages
    const formatted = formatPrismaError(err);
    statusCode = formatted.statusCode;
    message = formatted.message;
    code = 'DATABASE_ERROR';
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    // Prisma validation errors
    statusCode = 400;
    message = 'Invalid data provided';
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'UnauthorizedError') {
    // JWT errors
    statusCode = 401;
    message = 'Invalid or expired token';
    code = 'AUTHENTICATION_ERROR';
  } else if (err.name === 'MulterError') {
    // File upload errors
    statusCode = 400;
    message = err.message;
    code = 'UPLOAD_ERROR';
  } else {
    // Unknown errors - use generic message in production
    if (config.isProduction) {
      message = 'An unexpected error occurred';
      code = 'INTERNAL_ERROR';
    } else {
      // In development, show actual error
      message = err.message;
    }
  }

  // Build error response (safe for client)
  const errorResponse: ApiError = {
    success: false,
    error: {
      message,
      ...(code ? { code } : {}),
      ...(details && config.isDevelopment ? { details } : {}), // Only send details in dev
    },
  };

  // Include stack trace ONLY in development
  if (config.isDevelopment && !config.isProduction) {
    (errorResponse.error as { stack?: string }).stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const errorResponse: ApiError = {
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 'ROUTE_NOT_FOUND',
    },
  };

  res.status(404).json(errorResponse);
}

/**
 * Async handler wrapper
 * Catches errors from async route handlers
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

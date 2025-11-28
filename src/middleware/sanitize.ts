/**
 * Input Sanitization Middleware
 *
 * Sanitizes user input to prevent XSS attacks.
 * Applies to req.body and req.query recursively.
 */

import { Request, Response, NextFunction } from 'express';
import xss from 'xss';
import logger from '@/utils/logger';

/**
 * XSS filter options
 * More permissive than default to allow some HTML formatting
 */
const xssOptions = {
  whiteList: {}, // Empty whitelist = no HTML tags allowed
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
};

/**
 * Recursively sanitize an object's string values
 *
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle strings
  if (typeof obj === 'string') {
    return xss(obj, xssOptions);
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  // Handle objects
  if (typeof obj === 'object') {
    const sanitized: any = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Sanitize the key as well
        const sanitizedKey = xss(key, xssOptions);
        sanitized[sanitizedKey] = sanitizeObject(obj[key]);
      }
    }

    return sanitized;
  }

  // Return other types unchanged (numbers, booleans, etc.)
  return obj;
}

/**
 * Input sanitization middleware
 * Sanitizes req.body and req.query to prevent XSS
 *
 * Applied after body parsing middleware
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error('Sanitization error', { error });
    next();
  }
}

/**
 * Sanitize a single string value
 * Useful for manual sanitization
 *
 * @param input - String to sanitize
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  return xss(input, xssOptions);
}

/**
 * Sanitize HTML with more permissive options
 * Allows basic formatting tags (b, i, em, strong, etc.)
 *
 * @param input - HTML string to sanitize
 * @returns Sanitized HTML
 */
export function sanitizeHtml(input: string): string {
  const permissiveOptions = {
    whiteList: {
      b: [],
      i: [],
      em: [],
      strong: [],
      u: [],
      p: [],
      br: [],
      span: [],
    },
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
  };

  return xss(input, permissiveOptions);
}

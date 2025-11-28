/**
 * Authorization Middleware
 *
 * Role-based access control for admin routes.
 * Must be used AFTER authentication middleware.
 *
 * Features:
 * - Checks user role from database
 * - Brief cache (5 min) to reduce DB queries
 * - Detailed error messages
 */

import { Response, NextFunction, Request } from 'express';
import { UserRole } from '@prisma/client';
import logger from '@/utils/logger';

// ============================================================================
// ADMIN ROLE CACHE
// ============================================================================

/**
 * Cache for admin status checks
 * Reduces database queries for frequently accessed admin endpoints
 *
 * Structure: Map<userId, { isAdmin: boolean, expiresAt: number }>
 */
const adminCache = new Map<
  string,
  {
    isAdmin: boolean;
    expiresAt: number;
  }
>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Check if user is admin (with caching)
 *
 * @param userId - User ID to check
 * @param role - User role from request
 * @returns True if user is admin
 */
function isAdmin(userId: string, role: UserRole): boolean {
  // Check cache first
  const cached = adminCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    logger.debug('Admin status from cache', { userId, isAdmin: cached.isAdmin });
    return cached.isAdmin;
  }

  // Calculate admin status
  const adminStatus = role === UserRole.ADMIN;

  // Cache the result
  adminCache.set(userId, {
    isAdmin: adminStatus,
    expiresAt: Date.now() + CACHE_TTL,
  });

  logger.debug('Admin status cached', { userId, isAdmin: adminStatus });

  return adminStatus;
}

/**
 * Clear admin cache for a specific user
 * Call this when user role changes
 *
 * @param userId - User ID to clear from cache
 */
export function clearAdminCache(userId: string): void {
  adminCache.delete(userId);
  logger.debug('Admin cache cleared', { userId });
}

/**
 * Clear entire admin cache
 * Useful for testing or after bulk role updates
 */
export function clearAllAdminCache(): void {
  adminCache.clear();
  logger.debug('All admin cache cleared');
}

/**
 * Clean up expired cache entries
 * Should be called periodically to prevent memory leaks
 */
function cleanupExpiredCache(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [userId, entry] of adminCache.entries()) {
    if (entry.expiresAt <= now) {
      adminCache.delete(userId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.debug('Cleaned up expired admin cache entries', { count: cleaned });
  }
}

// Run cache cleanup every 10 minutes
setInterval(cleanupExpiredCache, 10 * 60 * 1000);

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Require Admin Middleware
 *
 * Ensures the authenticated user has ADMIN role.
 * Must be used after authenticate() middleware.
 *
 * @throws 401 - Authentication required
 * @throws 403 - Admin access required
 *
 * @example
 * router.get('/admin/users', authenticate, requireAdmin, getAllUsers);
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check if user is authenticated
    if (!req.user) {
      logger.warn('Admin middleware: No authenticated user');

      res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required. Please sign in.',
          code: 'AUTH_REQUIRED',
        },
      });
      return;
    }

    // Check admin status (with caching)
    if (!isAdmin(req.user.id, req.user.role)) {
      logger.warn('Admin access denied', {
        userId: req.user.id,
        role: req.user.role,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        error: {
          message: 'Admin access required. You do not have permission to access this resource.',
          code: 'ADMIN_REQUIRED',
        },
      });
      return;
    }

    // Log admin access
    logger.info('Admin access granted', {
      userId: req.user.id,
      email: req.user.email,
      path: req.path,
      method: req.method,
    });

    next();
  } catch (error) {
    logger.error('Admin middleware error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Authorization check failed due to server error.',
        code: 'AUTH_SERVER_ERROR',
      },
    });
  }
}

/**
 * Require Admin or Self Middleware
 *
 * Allows access if user is admin OR accessing their own resource.
 * Useful for profile endpoints where users can view/edit their own data
 * but admins can view/edit anyone's data.
 *
 * @param getUserIdFromRequest - Function to extract target user ID from request
 *
 * @example
 * router.get('/users/:id', authenticate,
 *   requireAdminOrSelf((req) => req.params.id),
 *   getUserProfile
 * );
 */
export function requireAdminOrSelf(getUserIdFromRequest: (req: Request) => string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required.',
            code: 'AUTH_REQUIRED',
          },
        });
        return;
      }

      const targetUserId = getUserIdFromRequest(req);
      const currentUserId = req.user.id;

      // Allow if user is admin
      if (isAdmin(currentUserId, req.user.role)) {
        logger.debug('Access granted: Admin', { userId: currentUserId });
        return next();
      }

      // Allow if user is accessing their own resource
      if (targetUserId === currentUserId) {
        logger.debug('Access granted: Self', { userId: currentUserId });
        return next();
      }

      // Deny access
      logger.warn('Access denied: Not admin or self', {
        currentUserId,
        targetUserId,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        error: {
          message: 'You can only access your own resources or be an admin.',
          code: 'ACCESS_DENIED',
        },
      });
    } catch (error) {
      logger.error('Admin or self middleware error:', error);

      res.status(500).json({
        success: false,
        error: {
          message: 'Authorization check failed.',
          code: 'AUTH_SERVER_ERROR',
        },
      });
    }
  };
}

/**
 * Require Customer Middleware
 *
 * Ensures user is a customer (not admin).
 * Useful for customer-only features.
 *
 * @throws 401 - Authentication required
 * @throws 403 - Customer access required
 */
export async function requireCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required.',
          code: 'AUTH_REQUIRED',
        },
      });
      return;
    }

    if (req.user.role !== UserRole.CUSTOMER) {
      logger.warn('Customer access denied', {
        userId: req.user.id,
        role: req.user.role,
      });

      res.status(403).json({
        success: false,
        error: {
          message: 'This feature is only available to customers.',
          code: 'CUSTOMER_REQUIRED',
        },
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Customer middleware error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Authorization check failed.',
        code: 'AUTH_SERVER_ERROR',
      },
    });
  }
}

/**
 * Get admin cache statistics
 *
 * Useful for monitoring and debugging.
 *
 * @returns Cache statistics
 */
export function getAdminCacheStats() {
  const now = Date.now();
  let active = 0;
  let expired = 0;

  for (const entry of adminCache.values()) {
    if (entry.expiresAt > now) {
      active++;
    } else {
      expired++;
    }
  }

  return {
    totalEntries: adminCache.size,
    activeEntries: active,
    expiredEntries: expired,
    cacheTTL: CACHE_TTL,
  };
}

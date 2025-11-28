/**
 * Authentication Routes
 *
 * Firebase authentication endpoints for user sync and profile management.
 * Supports Apple Sign-In, Google Sign-In, email, and phone authentication.
 *
 * Rate Limits:
 * - /sync: 10 requests per minute (prevents abuse of public endpoint)
 * - Other routes: 100 requests per minute
 */

import { Router } from 'express';
import * as authController from '@/controllers/auth.controller';
import { authenticate } from '@/middleware/auth';
import { requireAdmin } from '@/middleware/admin';
import { createRateLimiter } from '@/middleware/rateLimiter';

const router = Router();

// ============================================================================
// RATE LIMITERS
// ============================================================================

/**
 * Strict rate limiter for sync endpoint
 * 10 requests per minute to prevent abuse
 */
const syncLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many sync requests. Please try again in a minute.',
});

/**
 * Standard rate limiter for authenticated endpoints
 * 100 requests per minute
 */
const authEndpointLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'Too many requests. Please try again in a minute.',
});

// ============================================================================
// PUBLIC ROUTES
// ============================================================================

/**
 * POST /api/v1/auth/sync
 *
 * Sync Firebase user to database
 *
 * This endpoint should be called after successful sign-in on the client.
 * It creates or updates the user record in PostgreSQL with Firebase data.
 *
 * @body None - User data extracted from Firebase token
 * @returns User with role information
 */
router.post('/sync', syncLimiter, authController.syncUser);

// ============================================================================
// AUTHENTICATED ROUTES
// ============================================================================

/**
 * GET /api/v1/auth/me
 *
 * Get current user profile
 *
 * Returns the authenticated user's profile information.
 *
 * @returns User profile
 */
router.get('/me', authenticate, authEndpointLimiter, authController.getMe);

/**
 * PUT /api/v1/auth/profile
 *
 * Update user profile
 *
 * Updates the authenticated user's profile (firstName, lastName, phone).
 *
 * @body { firstName?: string, lastName?: string, phone?: string }
 * @returns Updated user profile
 */
router.put(
  '/profile',
  authenticate,
  authEndpointLimiter,
  authController.updateProfile
);

/**
 * DELETE /api/v1/auth/account
 *
 * Delete user account (GDPR compliance)
 *
 * Deletes the authenticated user's account and all related data.
 * Note: Firebase user should be deleted on the client using Firebase SDK.
 *
 * @returns Success message
 */
router.delete(
  '/account',
  authenticate,
  authEndpointLimiter,
  authController.deleteAccount
);

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * GET /api/v1/auth/stats
 *
 * Get user statistics (Admin only)
 *
 * Returns user statistics for admin dashboard.
 *
 * @returns { total, customers, admins, recentSignups }
 */
router.get(
  '/stats',
  authenticate,
  requireAdmin,
  authEndpointLimiter,
  authController.getUserStats
);

export default router;

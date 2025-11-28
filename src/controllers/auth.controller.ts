/**
 * Authentication Controller
 *
 * HTTP handlers for authentication endpoints.
 * Supports Apple Sign-In, Google Sign-In, email, and phone authentication.
 */

import { Response, Request } from 'express';
import { verifyIdToken } from '@/config/firebase';
import { DecodedFirebaseToken } from '@/models/user.model';
import * as authService from '@/services/auth.service';
import logger from '@/utils/logger';
import { z } from 'zod';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .optional(),
});

// ============================================================================
// CONTROLLERS
// ============================================================================

/**
 * Sync Firebase user to database
 *
 * POST /api/v1/auth/sync
 *
 * This endpoint should be called after successful sign-in on the client.
 * It creates or updates the user record in PostgreSQL with Firebase data.
 *
 * @returns User with role information
 */
export async function syncUser(req: Request, res: Response): Promise<void> {
  try {
    // Extract and verify token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Authentication token required',
          code: 'AUTH_TOKEN_MISSING',
        },
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verify Firebase token
    let decodedToken: DecodedFirebaseToken;
    try {
      decodedToken = (await verifyIdToken(token)) as DecodedFirebaseToken;
    } catch (error) {
      logger.warn('Token verification failed in sync endpoint');
      res.status(401).json({
        success: false,
        error: {
          message: 'Invalid or expired token',
          code: 'AUTH_TOKEN_INVALID',
        },
      });
      return;
    }

    // Sync user to database
    const user = await authService.syncUser(decodedToken);

    logger.info('User synced successfully', {
      userId: user.id,
      provider: decodedToken.firebase.sign_in_provider,
    });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
      message: 'User synchronized successfully',
    });
  } catch (error) {
    logger.error('Sync user error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to sync user',
        code: 'SYNC_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Get current user profile
 *
 * GET /api/v1/auth/me
 *
 * Returns the authenticated user's profile information.
 * Requires authentication middleware.
 */
export async function getMe(req: Request, res: Response): Promise<void> {
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

    // Fetch fresh user data from database
    const user = await authService.getUserById(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          stripeCustomerId: user.stripeCustomerId,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    logger.error('Get me error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch user profile',
        code: 'FETCH_ERROR',
      },
    });
  }
}

/**
 * Update user profile
 *
 * PUT /api/v1/auth/profile
 *
 * Updates the authenticated user's profile (firstName, lastName, phone).
 * Requires authentication middleware.
 */
export async function updateProfile(req: Request, res: Response): Promise<void> {
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

    // Validate request body
    const validationResult = updateProfileSchema.safeParse(req.body);
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

    const data = validationResult.data;

    // Update profile
    const user = await authService.updateUserProfile(req.user.id, data);

    logger.info('Profile updated', { userId: user.id });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          updatedAt: user.updatedAt,
        },
      },
      message: 'Profile updated successfully',
    });
  } catch (error) {
    logger.error('Update profile error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update profile',
        code: 'UPDATE_ERROR',
      },
    });
  }
}

/**
 * Delete user account
 *
 * DELETE /api/v1/auth/account
 *
 * Deletes the authenticated user's account (GDPR compliance).
 * This will cascade delete all related data.
 * Requires authentication middleware.
 *
 * Note: This only deletes from the database. The Firebase user
 * should be deleted on the client using Firebase SDK.
 */
export async function deleteAccount(req: Request, res: Response): Promise<void> {
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

    const userId = req.user.id;
    const userEmail = req.user.email;

    // Delete user account
    await authService.deleteUser(userId);

    logger.info('Account deleted', { userId, email: userEmail });

    res.status(200).json({
      success: true,
      data: null,
      message:
        'Account deleted successfully. Please also delete your Firebase account from the client.',
    });
  } catch (error) {
    logger.error('Delete account error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete account',
        code: 'DELETE_ERROR',
      },
    });
  }
}

/**
 * Get user statistics (Admin only)
 *
 * GET /api/v1/auth/stats
 *
 * Returns user statistics for admin dashboard.
 */
export async function getUserStats(req: Request, res: Response): Promise<void> {
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

    const stats = await authService.getUserStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Get user stats error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch user statistics',
        code: 'FETCH_ERROR',
      },
    });
  }
}

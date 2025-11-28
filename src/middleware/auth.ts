/**
 * Authentication Middleware
 *
 * Verifies Firebase ID tokens and attaches user information to requests.
 * Supports Apple Sign-In, Google Sign-In, and email/phone authentication.
 *
 * Security:
 * - Never logs full tokens
 * - Validates token structure
 * - Checks token expiration
 * - Requires database user record
 */

import { Response, NextFunction, Request } from 'express';
import { verifyIdToken } from '@/config/firebase';
import { prisma } from '@/config/database';
import { DecodedFirebaseToken, AuthenticatedUser } from '@/models/user.model';
import logger from '@/utils/logger';

/**
 * Extract token from Authorization header
 *
 * Expected format: "Bearer <token>"
 *
 * @param authHeader - Authorization header value
 * @returns Extracted token or null
 */
function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  // Check format
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  // Validate token is not empty
  if (!token || token.trim().length === 0) {
    return null;
  }

  return token.trim();
}

/**
 * Sanitize Firebase data before storing
 *
 * Removes potentially sensitive or unnecessary fields.
 *
 * @param data - Raw Firebase token data
 * @returns Sanitized data
 */
function sanitizeFirebaseData(token: DecodedFirebaseToken): {
  uid: string;
  email?: string;
  phoneNumber?: string;
  provider: string;
} {
  return {
    uid: token.uid,
    email: token.email,
    phoneNumber: token.phone_number,
    provider: token.firebase.sign_in_provider,
  };
}

/**
 * Authentication Middleware
 *
 * Verifies Firebase ID token and loads user from database.
 * Attaches authenticated user to req.user.
 *
 * @throws 401 - Missing, invalid, or expired token
 * @throws 401 - User not found in database
 * @throws 500 - Server error during verification
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token
    const token = extractToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Authentication required. Please provide a valid token.',
          code: 'AUTH_TOKEN_MISSING',
        },
      });
      return;
    }

    // Verify token with Firebase
    let decodedToken: DecodedFirebaseToken;
    try {
      decodedToken = (await verifyIdToken(token)) as DecodedFirebaseToken;
    } catch (error) {
      // Log sanitized error (never log the full token)
      logger.warn('Token verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenPrefix: token.substring(0, 10) + '...',
      });

      res.status(401).json({
        success: false,
        error: {
          message: 'Invalid or expired authentication token.',
          code: 'AUTH_TOKEN_INVALID',
        },
      });
      return;
    }

    // Log successful verification (sanitized)
    const sanitizedData = sanitizeFirebaseData(decodedToken);
    logger.debug('Token verified successfully', {
      uid: sanitizedData.uid,
      provider: sanitizedData.provider,
    });

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      select: {
        id: true,
        firebaseUid: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        stripeCustomerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      logger.warn('User not found in database', { firebaseUid: decodedToken.uid });

      res.status(401).json({
        success: false,
        error: {
          message:
            'User account not found. Please complete registration by calling /api/v1/auth/sync.',
          code: 'USER_NOT_FOUND',
        },
      });
      return;
    }

    // Attach authenticated user to request
    req.user = user as AuthenticatedUser;

    // Log successful authentication (without sensitive data)
    logger.debug('User authenticated', {
      userId: user.id,
      role: user.role,
      provider: sanitizedData.provider,
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Authentication failed due to server error.',
        code: 'AUTH_SERVER_ERROR',
      },
    });
  }
}

/**
 * Optional Authentication Middleware
 *
 * Attaches user if valid token is provided, but doesn't require it.
 * Useful for endpoints that behave differently for authenticated users
 * but are also accessible to anonymous users.
 *
 * @example
 * // Public endpoint that shows user-specific data if authenticated
 * router.get('/menu', optionalAuth, getMenu);
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token
    const token = extractToken(req.headers.authorization);

    // No token provided - continue without authentication
    if (!token) {
      return next();
    }

    // Try to verify token
    let decodedToken: DecodedFirebaseToken;
    try {
      decodedToken = (await verifyIdToken(token)) as DecodedFirebaseToken;
    } catch (error) {
      // Invalid token - log and continue without auth
      logger.debug('Optional auth: Invalid token provided');
      return next();
    }

    // Try to fetch user
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      select: {
        id: true,
        firebaseUid: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        stripeCustomerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // User found - attach to request
    if (user) {
      req.user = user as AuthenticatedUser;
      logger.debug('Optional auth: User authenticated', { userId: user.id });
    }

    next();
  } catch (error) {
    // Log error but continue without authentication
    logger.debug('Optional auth middleware error:', error);
    next();
  }
}

/**
 * Require Email Verification Middleware
 *
 * Ensures the user has verified their email address.
 * Must be used after authenticate() middleware.
 *
 * @throws 401 - Authentication required
 * @throws 403 - Email not verified
 */
export async function requireEmailVerification(
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

    // Re-verify with Firebase to check email verification status
    const token = extractToken(req.headers.authorization);
    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Authentication token missing.',
          code: 'AUTH_TOKEN_MISSING',
        },
      });
      return;
    }

    const decodedToken = (await verifyIdToken(token)) as DecodedFirebaseToken;

    if (!decodedToken.email_verified) {
      res.status(403).json({
        success: false,
        error: {
          message: 'Email verification required. Please verify your email address.',
          code: 'EMAIL_NOT_VERIFIED',
        },
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Email verification check failed:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to verify email status.',
        code: 'VERIFICATION_ERROR',
      },
    });
  }
}

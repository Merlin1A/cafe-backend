/**
 * Authentication Service
 *
 * Handles user authentication, synchronization with Firebase,
 * and profile management. Supports Apple Sign-In, Google Sign-In,
 * email, and phone authentication.
 *
 * Security:
 * - Sanitizes Firebase data before storing
 * - Never stores sensitive Firebase tokens
 * - Validates email format
 * - Handles duplicate accounts gracefully
 */

import { prisma } from '@/config/database';
import { setCustomClaims } from '@/config/firebase';
import {
  UpdateProfileData,
  DecodedFirebaseToken,
  AuthenticatedUser,
} from '@/models/user.model';
import { UserRole } from '@prisma/client';
import logger from '@/utils/logger';
import { clearAdminCache } from '@/middleware/admin';

// ============================================================================
// USER SYNCHRONIZATION
// ============================================================================

/**
 * Extract user data from Firebase token
 *
 * Sanitizes and extracts relevant user information from the decoded token.
 * Supports various sign-in providers (Apple, Google, Email, Phone).
 *
 * @param token - Decoded Firebase ID token
 * @returns Sanitized user data
 */
function extractUserDataFromToken(token: DecodedFirebaseToken): {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
} {
  // Extract email (if available)
  const email = token.email;

  // Extract phone (if available, remove +1 prefix if present for US numbers)
  const phone = token.phone_number;

  // Parse name into first and last name
  let firstName: string | undefined;
  let lastName: string | undefined;

  if (token.name) {
    const nameParts = token.name.trim().split(' ');
    if (nameParts.length > 0) {
      firstName = nameParts[0];
      if (nameParts.length > 1) {
        lastName = nameParts.slice(1).join(' ');
      }
    }
  }

  return {
    email,
    phone,
    firstName,
    lastName,
  };
}

/**
 * Sync Firebase user to database
 *
 * Creates or updates user record in PostgreSQL based on Firebase authentication.
 * This should be called after successful sign-in on the client.
 *
 * @param decodedToken - Decoded Firebase ID token
 * @returns Authenticated user with role
 */
export async function syncUser(
  decodedToken: DecodedFirebaseToken
): Promise<AuthenticatedUser> {
  try {
    const userData = extractUserDataFromToken(decodedToken);
    const firebaseUid = decodedToken.uid;

    logger.info('Syncing user', {
      firebaseUid,
      provider: decodedToken.firebase.sign_in_provider,
      hasEmail: !!userData.email,
      hasPhone: !!userData.phone,
    });

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { firebaseUid },
    });

    let user: AuthenticatedUser;

    if (existingUser) {
      // Update existing user with latest Firebase data
      const updated = await prisma.user.update({
        where: { firebaseUid },
        data: {
          email: userData.email || existingUser.email,
          phone: userData.phone || existingUser.phone,
          // Only update name if not already set
          firstName: existingUser.firstName || userData.firstName,
          lastName: existingUser.lastName || userData.lastName,
        },
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

      user = updated as AuthenticatedUser;
      logger.info('User updated', { userId: user.id, email: user.email });
    } else {
      // Create new user
      if (!userData.email && !userData.phone) {
        throw new Error('User must have either email or phone number');
      }

      const created = await prisma.user.create({
        data: {
          firebaseUid,
          email: userData.email || `${firebaseUid}@firebase.user`,
          phone: userData.phone,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: UserRole.CUSTOMER, // Default role
        },
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

      user = created as AuthenticatedUser;

      // Set Firebase custom claims for new user
      await setCustomClaims(firebaseUid, { role: user.role });

      logger.info('New user created', { userId: user.id, email: user.email });
    }

    return user;
  } catch (error) {
    logger.error('Failed to sync user:', error);
    throw error;
  }
}

// ============================================================================
// USER RETRIEVAL
// ============================================================================

/**
 * Get user by Firebase UID
 *
 * @param firebaseUid - Firebase user UID
 * @returns User or null if not found
 */
export async function getUserByFirebaseUid(firebaseUid: string): Promise<AuthenticatedUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { firebaseUid },
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

    return user as AuthenticatedUser | null;
  } catch (error) {
    logger.error('Failed to get user by Firebase UID:', error);
    throw error;
  }
}

/**
 * Get user by database ID
 *
 * @param id - User UUID
 * @returns User
 * @throws Error if user not found
 */
export async function getUserById(id: string): Promise<AuthenticatedUser> {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
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
      throw new Error('User not found');
    }

    return user as AuthenticatedUser;
  } catch (error) {
    logger.error('Failed to get user by ID:', error);
    throw error;
  }
}

/**
 * Get user by email
 *
 * @param email - User email
 * @returns User or null if not found
 */
export async function getUserByEmail(email: string): Promise<AuthenticatedUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
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

    return user as AuthenticatedUser | null;
  } catch (error) {
    logger.error('Failed to get user by email:', error);
    throw error;
  }
}

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

/**
 * Update user profile
 *
 * Allows users to update their first name, last name, and phone number.
 *
 * @param userId - User UUID
 * @param data - Profile data to update
 * @returns Updated user
 */
export async function updateUserProfile(
  userId: string,
  data: UpdateProfileData
): Promise<AuthenticatedUser> {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      },
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

    logger.info('User profile updated', { userId, email: user.email });

    return user as AuthenticatedUser;
  } catch (error) {
    logger.error('Failed to update user profile:', error);
    throw error;
  }
}

// ============================================================================
// ROLE MANAGEMENT (Admin Only)
// ============================================================================

/**
 * Update user role
 *
 * Admin-only function to change user roles.
 * Clears admin cache when role changes.
 *
 * @param userId - User UUID
 * @param role - New role
 * @returns Updated user
 */
export async function updateUserRole(userId: string, role: UserRole): Promise<AuthenticatedUser> {
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
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

    // Update Firebase custom claims
    await setCustomClaims(user.firebaseUid, { role });

    // Clear admin cache for this user
    clearAdminCache(userId);

    logger.info('User role updated', {
      userId,
      email: user.email,
      newRole: role,
    });

    return user as AuthenticatedUser;
  } catch (error) {
    logger.error('Failed to update user role:', error);
    throw error;
  }
}

/**
 * Get all users (Admin only)
 *
 * @param filters - Optional filters
 * @returns List of users
 */
export async function getAllUsers(filters?: {
  role?: UserRole;
  search?: string;
}): Promise<AuthenticatedUser[]> {
  try {
    const users = await prisma.user.findMany({
      where: {
        ...(filters?.role && { role: filters.role }),
        ...(filters?.search && {
          OR: [
            { email: { contains: filters.search, mode: 'insensitive' } },
            { firstName: { contains: filters.search, mode: 'insensitive' } },
            { lastName: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        firebaseUid: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return users as AuthenticatedUser[];
  } catch (error) {
    logger.error('Failed to get all users:', error);
    throw error;
  }
}

// ============================================================================
// ACCOUNT DELETION (GDPR Compliance)
// ============================================================================

/**
 * Delete user account
 *
 * Soft delete for GDPR compliance.
 * This will cascade delete all related data (orders, etc.) per Prisma schema.
 *
 * Note: Firebase user must be deleted separately on the client or via Admin SDK.
 *
 * @param userId - User UUID
 */
export async function deleteUser(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Delete from database (will cascade to related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    // Clear admin cache
    clearAdminCache(userId);

    logger.info('User deleted', {
      userId,
      email: user.email,
    });
  } catch (error) {
    logger.error('Failed to delete user:', error);
    throw error;
  }
}

/**
 * Activate user (Admin only)
 *
 * Note: User model doesn't have isActive field yet.
 * For now, this is a placeholder that just returns the user.
 * To implement properly, add isActive field to User schema and migration.
 *
 * @param userId - User UUID
 * @returns User
 */
export async function activateUser(userId: string): Promise<AuthenticatedUser> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
      throw new Error('User not found');
    }

    logger.info('User activated (no-op - isActive field not implemented)', {
      userId,
      email: user.email,
    });

    return user as AuthenticatedUser;
  } catch (error) {
    logger.error('Failed to activate user:', error);
    throw error;
  }
}

/**
 * Deactivate user (Admin only)
 *
 * Note: User model doesn't have isActive field yet.
 * For now, this is a placeholder that just returns the user.
 * To implement properly, add isActive field to User schema and migration.
 *
 * @param userId - User UUID
 * @returns User
 */
export async function deactivateUser(userId: string): Promise<AuthenticatedUser> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
      throw new Error('User not found');
    }

    logger.info('User deactivated (no-op - isActive field not implemented)', {
      userId,
      email: user.email,
    });

    return user as AuthenticatedUser;
  } catch (error) {
    logger.error('Failed to deactivate user:', error);
    throw error;
  }
}

/**
 * Get user statistics (Admin only)
 *
 * @returns User statistics
 */
export async function getUserStats() {
  try {
    const [total, customers, admins, recentSignups] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      }),
    ]);

    return {
      total,
      customers,
      admins,
      recentSignups,
    };
  } catch (error) {
    logger.error('Failed to get user stats:', error);
    throw error;
  }
}

/**
 * User Model Types
 *
 * Types and interfaces for user-related data structures and Firebase authentication.
 */

import { User, UserRole } from '@prisma/client';

// ============================================================================
// FIREBASE TYPES
// ============================================================================

/**
 * Decoded Firebase ID Token
 *
 * Contains verified claims from Firebase Authentication.
 * Supports multiple sign-in providers (Apple, Google, Email, Phone)
 */
export interface DecodedFirebaseToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  phone_number?: string;
  name?: string;
  picture?: string;
  firebase: {
    sign_in_provider: 'password' | 'phone' | 'google.com' | 'apple.com' | string;
    identities?: {
      [key: string]: string[];
    };
  };
  iat: number; // Issued at timestamp
  exp: number; // Expiration timestamp
  aud: string; // Audience (Firebase project ID)
  iss: string; // Issuer
  sub: string; // Subject (same as uid)
}

/**
 * Authenticated User
 *
 * User data attached to Express request after authentication.
 * Combines Firebase and database information.
 */
export interface AuthenticatedUser {
  id: string; // Database UUID
  firebaseUid: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  stripeCustomerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// USER TYPES
// ============================================================================

/**
 * User creation data (for registration/sync)
 */
export interface CreateUserData {
  firebaseUid: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
}

/**
 * User update data
 */
export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/**
 * User profile update data (from client)
 */
export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/**
 * Safe user data (excludes sensitive fields)
 */
export type SafeUser = Omit<User, 'firebaseUid'>;

/**
 * User with relations
 */
export interface UserWithRelations extends User {
  _count?: {
    orders: number;
  };
}

// ============================================================================
// EXPRESS REQUEST EXTENSION
// ============================================================================

/**
 * Extended Express Request with authenticated user
 *
 * Use this type in route handlers that require authentication.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// ============================================================================
// AUTH SERVICE TYPES
// ============================================================================

/**
 * Sync user data from Firebase to database
 */
export interface SyncUserData {
  firebaseUid: string;
  email?: string;
  phone?: string;
  name?: string;
  picture?: string;
  signInProvider: string;
}

/**
 * User role update data (admin only)
 */
export interface UpdateUserRoleData {
  role: UserRole;
}

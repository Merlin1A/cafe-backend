/**
 * Firebase Admin SDK Configuration
 *
 * Initializes Firebase Admin for authentication and cloud storage.
 * Used for verifying Firebase ID tokens and managing file uploads.
 */

import admin from 'firebase-admin';
import { config } from './index';
import logger from '@/utils/logger';

/**
 * Firebase Admin service account credentials
 */
const serviceAccount = {
  projectId: config.firebase.projectId,
  privateKey: config.firebase.privateKey,
  clientEmail: config.firebase.clientEmail,
};

/**
 * Initialize Firebase Admin SDK
 */
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: config.firebase.storageBucket,
  });
  logger.info('✓ Firebase Admin initialized successfully');
} catch (error) {
  logger.error('✗ Firebase Admin initialization failed:', error);
  throw error;
}

/**
 * Firebase Auth instance
 */
export const auth = admin.auth();

/**
 * Firebase Storage instance
 */
export const storage = admin.storage();

/**
 * Get storage bucket
 */
export const bucket = storage.bucket();

/**
 * Verify Firebase ID token
 * @param idToken - Firebase ID token from client
 * @returns Decoded token with user information
 */
export async function verifyIdToken(idToken: string) {
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    logger.error('Token verification failed:', error);
    throw new Error('Invalid or expired token');
  }
}

/**
 * Get user by Firebase UID
 * @param uid - Firebase user UID
 * @returns Firebase user record
 */
export async function getUserByUid(uid: string) {
  try {
    const user = await auth.getUser(uid);
    return user;
  } catch (error) {
    logger.error(`Failed to get user with UID ${uid}:`, error);
    throw new Error('User not found');
  }
}

/**
 * Get user by email
 * @param email - User email address
 * @returns Firebase user record
 */
export async function getUserByEmail(email: string) {
  try {
    const user = await auth.getUserByEmail(email);
    return user;
  } catch (error) {
    logger.error(`Failed to get user with email ${email}:`, error);
    throw new Error('User not found');
  }
}

/**
 * Create a new Firebase user
 * @param email - User email
 * @param password - User password
 * @param displayName - User display name (optional)
 * @returns Created user record
 */
export async function createFirebaseUser(email: string, password: string, displayName?: string) {
  try {
    const user = await auth.createUser({
      email,
      password,
      displayName: displayName ?? null,
      emailVerified: false,
    });
    logger.info(`Firebase user created: ${user.uid}`);
    return user;
  } catch (error) {
    logger.error('Failed to create Firebase user:', error);
    throw error;
  }
}

/**
 * Update Firebase user
 * @param uid - Firebase user UID
 * @param updates - User properties to update
 * @returns Updated user record
 */
export async function updateFirebaseUser(
  uid: string,
  updates: {
    email?: string;
    displayName?: string;
    phoneNumber?: string;
    photoURL?: string;
    emailVerified?: boolean;
    disabled?: boolean;
  }
) {
  try {
    const user = await auth.updateUser(uid, updates);
    logger.info(`Firebase user updated: ${uid}`);
    return user;
  } catch (error) {
    logger.error(`Failed to update Firebase user ${uid}:`, error);
    throw error;
  }
}

/**
 * Delete Firebase user
 * @param uid - Firebase user UID
 */
export async function deleteFirebaseUser(uid: string) {
  try {
    await auth.deleteUser(uid);
    logger.info(`Firebase user deleted: ${uid}`);
  } catch (error) {
    logger.error(`Failed to delete Firebase user ${uid}:`, error);
    throw error;
  }
}

/**
 * Set custom user claims (for role-based access control)
 * @param uid - Firebase user UID
 * @param claims - Custom claims object
 */
export async function setCustomClaims(uid: string, claims: Record<string, unknown>) {
  try {
    await auth.setCustomUserClaims(uid, claims);
    logger.info(`Custom claims set for user: ${uid}`);
  } catch (error) {
    logger.error(`Failed to set custom claims for user ${uid}:`, error);
    throw error;
  }
}

/**
 * Upload file to Firebase Storage
 * @param file - File buffer
 * @param destination - Destination path in storage
 * @param metadata - File metadata
 * @returns Public URL of uploaded file
 */
export async function uploadFile(
  file: Buffer,
  destination: string,
  metadata?: { contentType?: string; metadata?: Record<string, string> }
): Promise<string> {
  try {
    const fileRef = bucket.file(destination);

    const saveOptions: {
      metadata?: Record<string, string>;
      contentType?: string;
      public: boolean;
    } = {
      public: true,
    };

    if (metadata?.metadata) {
      saveOptions.metadata = metadata.metadata;
    }

    if (metadata?.contentType) {
      saveOptions.contentType = metadata.contentType;
    }

    await fileRef.save(file, saveOptions);

    // Make file publicly accessible
    await fileRef.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;

    logger.info(`File uploaded successfully: ${destination}`);
    return publicUrl;
  } catch (error) {
    logger.error(`Failed to upload file ${destination}:`, error);
    throw error;
  }
}

/**
 * Delete file from Firebase Storage
 * @param path - File path in storage
 */
export async function deleteFile(path: string): Promise<void> {
  try {
    await bucket.file(path).delete();
    logger.info(`File deleted successfully: ${path}`);
  } catch (error) {
    logger.error(`Failed to delete file ${path}:`, error);
    throw error;
  }
}

export default admin;

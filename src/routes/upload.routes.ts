/**
 * Upload Routes
 *
 * Image upload endpoints for menu items and categories.
 * All routes require admin authentication.
 */

import { Router } from 'express';
import multer from 'multer';
import * as uploadController from '@/controllers/upload.controller';
import { authenticate } from '@/middleware/auth';
import { requireAdmin } from '@/middleware/admin';
import { writeLimiter } from '@/middleware/rateLimiter';

const router = Router();

/**
 * Multer configuration for image uploads
 * - Memory storage (files stored in memory as Buffer)
 * - Max file size: 5MB
 * - Allowed types: JPEG, PNG, WebP
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1, // Only 1 file per request
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Use JPEG, PNG, or WebP.'));
    }
  },
});

/**
 * POST /api/v1/admin/upload/menu-item-image/:itemId
 *
 * Upload image for a menu item
 * - Multipart form data with 'image' field
 * - Max 5MB
 * - Returns { imageUrl, thumbnailUrl }
 * - Updates MenuItem record with URLs
 *
 * Admin only
 */
router.post(
  '/menu-item-image/:itemId',
  authenticate,
  requireAdmin,
  writeLimiter,
  upload.single('image'),
  uploadController.uploadMenuItemImage
);

/**
 * POST /api/v1/admin/upload/category-image/:categoryId
 *
 * Upload image for a category
 * - Multipart form data with 'image' field
 * - Max 5MB
 * - Returns { imageUrl, thumbnailUrl }
 * - Updates Category record with URLs
 *
 * Admin only
 */
router.post(
  '/category-image/:categoryId',
  authenticate,
  requireAdmin,
  writeLimiter,
  upload.single('image'),
  uploadController.uploadCategoryImage
);

/**
 * DELETE /api/v1/admin/upload/image
 *
 * Delete an image from storage
 * - Body: { imageUrl: string }
 *
 * Admin only
 */
router.delete(
  '/image',
  authenticate,
  requireAdmin,
  writeLimiter,
  uploadController.deleteImage
);

/**
 * POST /api/v1/admin/upload/signed-url
 *
 * Get signed upload URL for direct client uploads
 * - Body: { filename: string, contentType: string, expiresInMinutes?: number }
 * - Returns { uploadUrl, publicUrl }
 *
 * Admin only
 */
router.post(
  '/signed-url',
  authenticate,
  requireAdmin,
  writeLimiter,
  uploadController.getSignedUploadUrl
);

export default router;

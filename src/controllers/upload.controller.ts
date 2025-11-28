/**
 * Upload Controller
 *
 * Handles image upload endpoints for menu items and categories.
 * Processes images and uploads to Firebase Cloud Storage.
 */

import { Request, Response } from 'express';
import storageService from '@/services/storage.service';
import { prisma } from '@/config/database';
import logger from '@/utils/logger';

/**
 * Upload menu item image
 * POST /api/v1/admin/upload/menu-item-image/:itemId
 *
 * Uploads and processes image for a menu item
 * Updates MenuItem record with image URLs
 */
export async function uploadMenuItemImage(req: Request, res: Response): Promise<void> {
  try {
    const { itemId } = req.params;

    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: {
          message: 'No image file provided',
          code: 'NO_FILE',
        },
      });
      return;
    }

    // Validate file
    try {
      storageService.validateFile(req.file);
    } catch (validationError) {
      res.status(400).json({
        success: false,
        error: {
          message: validationError instanceof Error ? validationError.message : 'Invalid file',
          code: 'INVALID_FILE',
        },
      });
      return;
    }

    // Check if menu item exists
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: itemId },
    });

    if (!menuItem) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Menu item not found',
          code: 'NOT_FOUND',
        },
      });
      return;
    }

    logger.info('Uploading menu item image', {
      itemId,
      fileName: req.file.originalname,
      size: req.file.size,
    });

    // Delete old images if they exist
    if (menuItem.imageUrl) {
      try {
        await storageService.deleteEntityImages('menu-items', itemId);
      } catch (error) {
        logger.warn('Failed to delete old menu item images', { error, itemId });
        // Continue with upload even if deletion fails
      }
    }

    // Upload and process image
    const { imageUrl, thumbnailUrl } = await storageService.uploadImage(
      req.file,
      'menu-items',
      itemId
    );

    // Update menu item with image URLs
    const updatedMenuItem = await prisma.menuItem.update({
      where: { id: itemId },
      data: {
        imageUrl,
        thumbnailUrl,
      },
    });

    logger.info('Menu item image uploaded successfully', {
      itemId,
      imageUrl,
      thumbnailUrl,
    });

    res.status(200).json({
      success: true,
      data: {
        imageUrl,
        thumbnailUrl,
        menuItem: updatedMenuItem,
      },
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    logger.error('Menu item image upload failed', { error });

    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to upload image',
        code: 'UPLOAD_ERROR',
      },
    });
  }
}

/**
 * Upload category image
 * POST /api/v1/admin/upload/category-image/:categoryId
 *
 * Uploads and processes image for a category
 * Updates Category record with image URLs
 */
export async function uploadCategoryImage(req: Request, res: Response): Promise<void> {
  try {
    const { categoryId } = req.params;

    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: {
          message: 'No image file provided',
          code: 'NO_FILE',
        },
      });
      return;
    }

    // Validate file
    try {
      storageService.validateFile(req.file);
    } catch (validationError) {
      res.status(400).json({
        success: false,
        error: {
          message: validationError instanceof Error ? validationError.message : 'Invalid file',
          code: 'INVALID_FILE',
        },
      });
      return;
    }

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Category not found',
          code: 'NOT_FOUND',
        },
      });
      return;
    }

    logger.info('Uploading category image', {
      categoryId,
      fileName: req.file.originalname,
      size: req.file.size,
    });

    // Delete old images if they exist
    if (category.imageUrl) {
      try {
        await storageService.deleteEntityImages('categories', categoryId);
      } catch (error) {
        logger.warn('Failed to delete old category images', { error, categoryId });
        // Continue with upload even if deletion fails
      }
    }

    // Upload and process image
    const { imageUrl, thumbnailUrl } = await storageService.uploadImage(
      req.file,
      'categories',
      categoryId
    );

    // Update category with image URLs
    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: {
        imageUrl,
      },
    });

    logger.info('Category image uploaded successfully', {
      categoryId,
      imageUrl,
      thumbnailUrl,
    });

    res.status(200).json({
      success: true,
      data: {
        imageUrl,
        thumbnailUrl,
        category: updatedCategory,
      },
      message: 'Image uploaded successfully',
    });
  } catch (error) {
    logger.error('Category image upload failed', { error });

    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to upload image',
        code: 'UPLOAD_ERROR',
      },
    });
  }
}

/**
 * Delete image
 * DELETE /api/v1/admin/upload/image
 *
 * Deletes an image from Firebase Storage
 * Body: { imageUrl: string }
 */
export async function deleteImage(req: Request, res: Response): Promise<void> {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      res.status(400).json({
        success: false,
        error: {
          message: 'Image URL is required',
          code: 'INVALID_INPUT',
        },
      });
      return;
    }

    logger.info('Deleting image', { imageUrl });

    // Delete image from storage
    await storageService.deleteImage(imageUrl);

    logger.info('Image deleted successfully', { imageUrl });

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    logger.error('Image deletion failed', { error });

    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to delete image',
        code: 'DELETE_ERROR',
      },
    });
  }
}

/**
 * Get signed upload URL
 * POST /api/v1/admin/upload/signed-url
 *
 * Generates a signed URL for direct client-side uploads
 * Body: { filename: string, contentType: string, expiresInMinutes?: number }
 */
export async function getSignedUploadUrl(req: Request, res: Response): Promise<void> {
  try {
    const { filename, contentType, expiresInMinutes } = req.body;

    if (!filename || !contentType) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Filename and contentType are required',
          code: 'INVALID_INPUT',
        },
      });
      return;
    }

    logger.info('Generating signed upload URL', { filename, contentType });

    // Generate signed URL
    const { uploadUrl, publicUrl } = await storageService.getSignedUploadUrl(
      filename,
      contentType,
      expiresInMinutes || 15
    );

    logger.info('Signed upload URL generated', { filename });

    res.status(200).json({
      success: true,
      data: {
        uploadUrl,
        publicUrl,
      },
      message: 'Signed URL generated successfully',
    });
  } catch (error) {
    logger.error('Failed to generate signed upload URL', { error });

    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to generate signed URL',
        code: 'SIGNED_URL_ERROR',
      },
    });
  }
}

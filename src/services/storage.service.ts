/**
 * Storage Service
 *
 * Handles Firebase Cloud Storage operations for menu images including:
 * - Image upload with processing (resize, convert to WebP, thumbnail generation)
 * - Image deletion
 * - Signed upload URL generation
 */

import sharp from 'sharp';
import { bucket } from '@/config/firebase';
import logger from '@/utils/logger';

// Image processing constants
const MAX_IMAGE_SIZE = 800;
const THUMBNAIL_SIZE = 200;
const IMAGE_QUALITY = 85;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

class StorageService {
  private bucket: typeof bucket;

  constructor() {
    this.bucket = bucket;
  }

  /**
   * Upload and process an image for menu items or categories
   *
   * Processing steps:
   * 1. Validate file type (jpeg, png, webp only)
   * 2. Resize to max 800x800 maintaining aspect ratio
   * 3. Convert to WebP format
   * 4. Strip EXIF data for privacy
   * 5. Generate 200x200 thumbnail
   * 6. Upload both to Firebase Storage
   *
   * @param file - Multer file object
   * @param folder - Storage folder ('menu-items' or 'categories')
   * @param entityId - ID of the menu item or category
   * @returns Object with imageUrl and thumbnailUrl
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: 'menu-items' | 'categories',
    entityId: string
  ): Promise<{ imageUrl: string; thumbnailUrl: string }> {
    try {
      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new Error('Invalid file type. Use JPEG, PNG, or WebP.');
      }

      logger.info('Processing image upload', {
        folder,
        entityId,
        originalSize: file.size,
        mimeType: file.mimetype,
      });

      // Process main image: resize to max 800x800, convert to WebP, strip EXIF
      const processedImage = await sharp(file.buffer)
        .resize(MAX_IMAGE_SIZE, MAX_IMAGE_SIZE, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: IMAGE_QUALITY })
        .toBuffer();

      // Process thumbnail: 200x200, convert to WebP
      const thumbnailImage = await sharp(file.buffer)
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: IMAGE_QUALITY })
        .toBuffer();

      // Define storage paths
      const mainImagePath = `cafe-images/${folder}/${entityId}/main.webp`;
      const thumbnailPath = `cafe-images/${folder}/${entityId}/thumb.webp`;

      // Upload main image
      const mainImageUrl = await this.uploadToStorage(
        processedImage,
        mainImagePath,
        'image/webp'
      );

      // Upload thumbnail
      const thumbnailUrl = await this.uploadToStorage(
        thumbnailImage,
        thumbnailPath,
        'image/webp'
      );

      logger.info('Image upload successful', {
        folder,
        entityId,
        mainImageUrl,
        thumbnailUrl,
      });

      return {
        imageUrl: mainImageUrl,
        thumbnailUrl,
      };
    } catch (error) {
      logger.error('Image upload failed', { error, folder, entityId });
      throw error;
    }
  }

  /**
   * Upload buffer to Firebase Storage
   * Sets public read access and caching headers
   *
   * @param buffer - File buffer
   * @param path - Storage path
   * @param contentType - MIME type
   * @returns Public URL
   */
  private async uploadToStorage(
    buffer: Buffer,
    path: string,
    contentType: string
  ): Promise<string> {
    const file = this.bucket.file(path);

    await file.save(buffer, {
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000', // 1 year cache
      },
      public: true,
    });

    // Make file publicly accessible
    await file.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${encodeURIComponent(path)}`;

    return publicUrl;
  }

  /**
   * Delete an image from Firebase Storage
   * Extracts path from URL and deletes the file
   *
   * @param imageUrl - Full public URL of the image
   */
  async deleteImage(imageUrl: string): Promise<void> {
    try {
      const url = new URL(imageUrl);
      const pathMatch = url.pathname.match(/\/([^\/]+)\/(.+)$/);

      if (!pathMatch || pathMatch.length < 3 || !pathMatch[2]) {
        throw new Error('Invalid image URL format');
      }

      const path = decodeURIComponent(pathMatch[2]);

      if (!path.startsWith('cafe-images/')) {
        throw new Error('Can only delete images from cafe-images folder');
      }

      if (path.includes('..') || path.includes('//')) {
        throw new Error('Invalid path: path traversal detected');
      }

      const bucketName = pathMatch[1];
      if (bucketName !== this.bucket.name) {
        throw new Error('Can only delete images from this application bucket');
      }

      logger.info('Deleting image', { path, imageUrl });

      await this.bucket.file(path).delete();

      logger.info('Image deleted successfully', { path });
    } catch (error) {
      logger.error('Image deletion failed', { error, imageUrl });
      throw error;
    }
  }

  /**
   * Delete all images for an entity (both main and thumbnail)
   *
   * @param folder - Storage folder ('menu-items' or 'categories')
   * @param entityId - ID of the menu item or category
   */
  async deleteEntityImages(
    folder: 'menu-items' | 'categories',
    entityId: string
  ): Promise<void> {
    try {
      const mainImagePath = `cafe-images/${folder}/${entityId}/main.webp`;
      const thumbnailPath = `cafe-images/${folder}/${entityId}/thumb.webp`;

      logger.info('Deleting entity images', { folder, entityId });

      // Delete both files (ignore errors if they don't exist)
      try {
        await this.bucket.file(mainImagePath).delete();
      } catch (error) {
        logger.warn('Main image not found or already deleted', { mainImagePath });
      }

      try {
        await this.bucket.file(thumbnailPath).delete();
      } catch (error) {
        logger.warn('Thumbnail not found or already deleted', { thumbnailPath });
      }

      logger.info('Entity images deleted', { folder, entityId });
    } catch (error) {
      logger.error('Entity images deletion failed', { error, folder, entityId });
      throw error;
    }
  }

  /**
   * Generate a signed upload URL for client-side uploads
   * Allows iOS app to upload directly to Firebase Storage
   *
   * @param filename - Original filename
   * @param contentType - MIME type
   * @param expiresInMinutes - URL expiration time in minutes
   * @returns Upload URL and public URL
   */
  async getSignedUploadUrl(
    filename: string,
    contentType: string,
    expiresInMinutes: number = 15
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    try {
      // Validate content type
      if (!ALLOWED_MIME_TYPES.includes(contentType)) {
        throw new Error('Invalid content type. Use JPEG, PNG, or WebP.');
      }

      // Generate unique path
      const timestamp = Date.now();
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const path = `cafe-images/uploads/${timestamp}-${sanitizedFilename}`;

      // Generate signed upload URL
      const [uploadUrl] = await this.bucket.file(path).getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
        contentType,
      });

      // Public URL (will be accessible after upload)
      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${encodeURIComponent(path)}`;

      logger.info('Signed upload URL generated', { path, expiresInMinutes });

      return {
        uploadUrl,
        publicUrl,
      };
    } catch (error) {
      logger.error('Failed to generate signed upload URL', { error, filename });
      throw error;
    }
  }

  /**
   * Validate file before upload
   *
   * @param file - Multer file object
   * @param maxSizeBytes - Maximum file size in bytes
   */
  validateFile(file: Express.Multer.File, maxSizeBytes: number = 5 * 1024 * 1024): void {
    // Check file size
    if (file.size > maxSizeBytes) {
      throw new Error(`File size exceeds ${maxSizeBytes / 1024 / 1024}MB limit`);
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error('Invalid file type. Use JPEG, PNG, or WebP.');
    }
  }

  /**
   * Get file metadata from storage
   *
   * @param path - Storage path
   * @returns File metadata
   */
  async getFileMetadata(path: string) {
    try {
      const [metadata] = await this.bucket.file(path).getMetadata();
      return metadata;
    } catch (error) {
      logger.error('Failed to get file metadata', { error, path });
      throw error;
    }
  }

  /**
   * Check if file exists in storage
   *
   * @param path - Storage path
   * @returns True if file exists
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      const [exists] = await this.bucket.file(path).exists();
      return exists;
    } catch (error) {
      logger.error('Failed to check file existence', { error, path });
      return false;
    }
  }
}

// Export singleton instance
export default new StorageService();

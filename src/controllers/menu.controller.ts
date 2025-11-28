/**
 * Menu Controller
 *
 * HTTP handlers for menu management endpoints.
 * Includes public endpoints (cached) and admin endpoints (with cache invalidation).
 */

import { Request, Response } from 'express';
import * as menuService from '@/services/menu.service';
import logger from '@/utils/logger';
import {
  createCategorySchema,
  updateCategorySchema,
  createMenuItemSchema,
  updateMenuItemSchema,
  createModifierGroupSchema,
  updateModifierGroupSchema,
  createModifierSchema,
  updateModifierSchema,
} from '@/utils/validators';

// ============================================================================
// PUBLIC ENDPOINTS (NO AUTH REQUIRED)
// ============================================================================

/**
 * Get all active categories
 * GET /api/v1/menu/categories
 *
 * Returns all active categories sorted by displayOrder with item counts.
 * Response is cached for 5 minutes.
 */
export async function getCategories(req: Request, res: Response): Promise<void> {
  try {
    const categories = await menuService.getCategories();

    res.status(200).json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    logger.error('Get categories error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch categories',
        code: 'FETCH_ERROR',
      },
    });
  }
}

/**
 * Get menu items in a category
 * GET /api/v1/menu/categories/:categoryId/items
 *
 * Returns available menu items in a category with modifier groups and modifiers.
 * Query params: ?popular=true to filter for popular items only
 * Response is cached for 5 minutes.
 */
export async function getCategoryItems(req: Request, res: Response): Promise<void> {
  try {
    const { categoryId } = req.params;
    const popular = req.query.popular === 'true';

    const items = await menuService.getCategoryItems(categoryId, popular);

    res.status(200).json({
      success: true,
      data: { items },
    });
  } catch (error) {
    logger.error('Get category items error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch menu items',
        code: 'FETCH_ERROR',
      },
    });
  }
}

/**
 * Get single menu item
 * GET /api/v1/menu/items/:itemId
 *
 * Returns single menu item with full details including modifier groups.
 * Response is cached for 5 minutes.
 * Returns 404 if not found or not available.
 */
export async function getItemById(req: Request, res: Response): Promise<void> {
  try {
    const { itemId } = req.params;

    const item = await menuService.getItemById(itemId);

    if (!item) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Menu item not found or not available',
          code: 'MENU_ITEM_NOT_FOUND',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { item },
    });
  } catch (error) {
    logger.error('Get item error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch menu item',
        code: 'FETCH_ERROR',
      },
    });
  }
}

/**
 * Search menu items
 * GET /api/v1/menu/search?q=query
 *
 * Search items by name/description (case-insensitive).
 * Returns matching items across all categories.
 * Limit 20 results.
 * Response is cached for 5 minutes.
 */
export async function searchItems(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query.q as string;

    if (!query || query.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Search query is required',
          code: 'VALIDATION_ERROR',
        },
      });
      return;
    }

    const items = await menuService.searchItems(query.trim());

    res.status(200).json({
      success: true,
      data: { items, query: query.trim() },
    });
  } catch (error) {
    logger.error('Search items error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to search menu items',
        code: 'SEARCH_ERROR',
      },
    });
  }
}

/**
 * Get featured items
 * GET /api/v1/menu/featured
 *
 * Returns items where isPopular=true.
 * Limit 10 items.
 * Response is cached for 5 minutes.
 */
export async function getFeaturedItems(req: Request, res: Response): Promise<void> {
  try {
    const items = await menuService.getFeaturedItems();

    res.status(200).json({
      success: true,
      data: { items },
    });
  } catch (error) {
    logger.error('Get featured items error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch featured items',
        code: 'FETCH_ERROR',
      },
    });
  }
}

// ============================================================================
// ADMIN ENDPOINTS - CATEGORIES
// ============================================================================

/**
 * Create category
 * POST /api/v1/admin/menu/categories
 *
 * Creates a new category. Invalidates cache.
 */
export async function createCategory(req: Request, res: Response): Promise<void> {
  try {
    const validationResult = createCategorySchema.safeParse(req.body);

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

    const category = await menuService.createCategory(validationResult.data);

    logger.info('Category created by admin', {
      adminId: req.user?.id,
      categoryId: category.id,
    });

    res.status(201).json({
      success: true,
      data: { category },
      message: 'Category created successfully',
    });
  } catch (error) {
    logger.error('Create category error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create category',
        code: 'CREATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Update category
 * PUT /api/v1/admin/menu/categories/:categoryId
 *
 * Updates a category. Invalidates cache.
 */
export async function updateCategory(req: Request, res: Response): Promise<void> {
  try {
    const { categoryId } = req.params;

    const validationResult = updateCategorySchema.safeParse(req.body);

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

    const category = await menuService.updateCategory(categoryId, validationResult.data);

    logger.info('Category updated by admin', {
      adminId: req.user?.id,
      categoryId,
    });

    res.status(200).json({
      success: true,
      data: { category },
      message: 'Category updated successfully',
    });
  } catch (error) {
    logger.error('Update category error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Category not found',
          code: 'CATEGORY_NOT_FOUND',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update category',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Delete category
 * DELETE /api/v1/admin/menu/categories/:categoryId
 *
 * Soft delete (set isActive=false) if category has items.
 * Hard delete if category has no items.
 * Invalidates cache.
 */
export async function deleteCategory(req: Request, res: Response): Promise<void> {
  try {
    const { categoryId } = req.params;

    const result = await menuService.deleteCategory(categoryId);

    logger.info('Category deleted by admin', {
      adminId: req.user?.id,
      categoryId,
      softDelete: result.softDelete,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: result.softDelete
        ? 'Category deactivated (has items)'
        : 'Category deleted successfully',
    });
  } catch (error) {
    logger.error('Delete category error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Category not found',
          code: 'CATEGORY_NOT_FOUND',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete category',
        code: 'DELETE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

// ============================================================================
// ADMIN ENDPOINTS - MENU ITEMS
// ============================================================================

/**
 * Create menu item
 * POST /api/v1/admin/menu/items
 *
 * Creates a new menu item. Invalidates cache.
 */
export async function createMenuItem(req: Request, res: Response): Promise<void> {
  try {
    const validationResult = createMenuItemSchema.safeParse(req.body);

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

    const menuItem = await menuService.createMenuItem(validationResult.data);

    logger.info('Menu item created by admin', {
      adminId: req.user?.id,
      itemId: menuItem.id,
    });

    res.status(201).json({
      success: true,
      data: { menuItem },
      message: 'Menu item created successfully',
    });
  } catch (error) {
    logger.error('Create menu item error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create menu item',
        code: 'CREATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Update menu item
 * PUT /api/v1/admin/menu/items/:itemId
 *
 * Updates a menu item. Invalidates cache.
 */
export async function updateMenuItem(req: Request, res: Response): Promise<void> {
  try {
    const { itemId } = req.params;

    const validationResult = updateMenuItemSchema.safeParse(req.body);

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

    const menuItem = await menuService.updateMenuItem(itemId, validationResult.data);

    logger.info('Menu item updated by admin', {
      adminId: req.user?.id,
      itemId,
    });

    res.status(200).json({
      success: true,
      data: { menuItem },
      message: 'Menu item updated successfully',
    });
  } catch (error) {
    logger.error('Update menu item error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Menu item not found',
          code: 'MENU_ITEM_NOT_FOUND',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update menu item',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Delete menu item
 * DELETE /api/v1/admin/menu/items/:itemId
 *
 * Soft delete (set isAvailable=false). Invalidates cache.
 */
export async function deleteMenuItem(req: Request, res: Response): Promise<void> {
  try {
    const { itemId } = req.params;

    const menuItem = await menuService.deleteMenuItem(itemId);

    logger.info('Menu item soft deleted by admin', {
      adminId: req.user?.id,
      itemId,
    });

    res.status(200).json({
      success: true,
      data: { menuItem },
      message: 'Menu item deactivated successfully',
    });
  } catch (error) {
    logger.error('Delete menu item error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Menu item not found',
          code: 'MENU_ITEM_NOT_FOUND',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete menu item',
        code: 'DELETE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

// ============================================================================
// ADMIN ENDPOINTS - MODIFIER GROUPS
// ============================================================================

/**
 * Create modifier group for a menu item
 * POST /api/v1/admin/menu/items/:itemId/modifier-groups
 *
 * Creates a new modifier group. Invalidates cache.
 */
export async function createModifierGroup(req: Request, res: Response): Promise<void> {
  try {
    const { itemId } = req.params;

    const validationResult = createModifierGroupSchema.safeParse(req.body);

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

    const modifierGroup = await menuService.createModifierGroup({
      ...validationResult.data,
      menuItemId: itemId,
    });

    logger.info('Modifier group created by admin', {
      adminId: req.user?.id,
      groupId: modifierGroup.id,
      itemId,
    });

    res.status(201).json({
      success: true,
      data: { modifierGroup },
      message: 'Modifier group created successfully',
    });
  } catch (error) {
    logger.error('Create modifier group error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create modifier group',
        code: 'CREATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Update modifier group
 * PUT /api/v1/admin/menu/modifier-groups/:groupId
 *
 * Updates a modifier group. Invalidates cache.
 */
export async function updateModifierGroup(req: Request, res: Response): Promise<void> {
  try {
    const { groupId } = req.params;

    const validationResult = updateModifierGroupSchema.safeParse(req.body);

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

    const modifierGroup = await menuService.updateModifierGroup(groupId, validationResult.data);

    logger.info('Modifier group updated by admin', {
      adminId: req.user?.id,
      groupId,
    });

    res.status(200).json({
      success: true,
      data: { modifierGroup },
      message: 'Modifier group updated successfully',
    });
  } catch (error) {
    logger.error('Update modifier group error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Modifier group not found',
          code: 'MODIFIER_GROUP_NOT_FOUND',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update modifier group',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Delete modifier group
 * DELETE /api/v1/admin/menu/modifier-groups/:groupId
 *
 * Hard delete (cascades to modifiers). Invalidates cache.
 */
export async function deleteModifierGroup(req: Request, res: Response): Promise<void> {
  try {
    const { groupId } = req.params;

    const modifierGroup = await menuService.deleteModifierGroup(groupId);

    logger.info('Modifier group deleted by admin', {
      adminId: req.user?.id,
      groupId,
    });

    res.status(200).json({
      success: true,
      data: { modifierGroup },
      message: 'Modifier group deleted successfully',
    });
  } catch (error) {
    logger.error('Delete modifier group error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Modifier group not found',
          code: 'MODIFIER_GROUP_NOT_FOUND',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete modifier group',
        code: 'DELETE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

// ============================================================================
// ADMIN ENDPOINTS - MODIFIERS
// ============================================================================

/**
 * Create modifier for a modifier group
 * POST /api/v1/admin/menu/modifier-groups/:groupId/modifiers
 *
 * Creates a new modifier. Invalidates cache.
 */
export async function createModifier(req: Request, res: Response): Promise<void> {
  try {
    const { groupId } = req.params;

    const validationResult = createModifierSchema.safeParse(req.body);

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

    const modifier = await menuService.createModifier({
      ...validationResult.data,
      modifierGroupId: groupId,
    });

    logger.info('Modifier created by admin', {
      adminId: req.user?.id,
      modifierId: modifier.id,
      groupId,
    });

    res.status(201).json({
      success: true,
      data: { modifier },
      message: 'Modifier created successfully',
    });
  } catch (error) {
    logger.error('Create modifier error:', error);

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create modifier',
        code: 'CREATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Update modifier
 * PUT /api/v1/admin/menu/modifiers/:modifierId
 *
 * Updates a modifier. Invalidates cache.
 */
export async function updateModifier(req: Request, res: Response): Promise<void> {
  try {
    const { modifierId } = req.params;

    const validationResult = updateModifierSchema.safeParse(req.body);

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

    const modifier = await menuService.updateModifier(modifierId, validationResult.data);

    logger.info('Modifier updated by admin', {
      adminId: req.user?.id,
      modifierId,
    });

    res.status(200).json({
      success: true,
      data: { modifier },
      message: 'Modifier updated successfully',
    });
  } catch (error) {
    logger.error('Update modifier error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Modifier not found',
          code: 'MODIFIER_NOT_FOUND',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update modifier',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Delete modifier
 * DELETE /api/v1/admin/menu/modifiers/:modifierId
 *
 * Hard delete. Invalidates cache.
 */
export async function deleteModifier(req: Request, res: Response): Promise<void> {
  try {
    const { modifierId } = req.params;

    const modifier = await menuService.deleteModifier(modifierId);

    logger.info('Modifier deleted by admin', {
      adminId: req.user?.id,
      modifierId,
    });

    res.status(200).json({
      success: true,
      data: { modifier },
      message: 'Modifier deleted successfully',
    });
  } catch (error) {
    logger.error('Delete modifier error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Modifier not found',
          code: 'MODIFIER_NOT_FOUND',
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete modifier',
        code: 'DELETE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Menu Service
 *
 * Handles menu management including categories, items, modifiers, and modifier groups.
 * Provides CRUD operations with caching for public endpoints.
 *
 * Caching Strategy:
 * - Public endpoints cached for 5 minutes
 * - Cache invalidated on admin mutations
 */

import { prisma } from '@/config/database';
import logger from '@/utils/logger';
import NodeCache from 'node-cache';
import { PrinterDestination } from '@prisma/client';

// ============================================================================
// CACHE SETUP
// ============================================================================

/**
 * Cache for menu data
 * TTL: 5 minutes (300 seconds)
 */
const menuCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Cache keys
 */
const CACHE_KEYS = {
  CATEGORIES: 'categories',
  FEATURED_ITEMS: 'featured_items',
  categoryItems: (categoryId: string) => `category_${categoryId}_items`,
  item: (itemId: string) => `item_${itemId}`,
  search: (query: string) => `search_${query.toLowerCase()}`,
};

/**
 * Invalidate all menu caches
 * Call this after any admin mutation
 */
export function invalidateMenuCache(): void {
  menuCache.flushAll();
  logger.debug('Menu cache invalidated');
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CreateCategoryData {
  name: string;
  description?: string;
  displayOrder?: number;
  imageUrl?: string;
  isActive?: boolean;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  displayOrder?: number;
  imageUrl?: string;
  isActive?: boolean;
}

export interface CreateMenuItemData {
  categoryId: string;
  name: string;
  description?: string;
  basePrice: number;
  preparationTime?: number;
  calories?: number;
  allergens?: string[];
  printerDestination?: PrinterDestination;
  imageUrl?: string;
  thumbnailUrl?: string;
  isAvailable?: boolean;
  isPopular?: boolean;
  displayOrder?: number;
}

export interface UpdateMenuItemData {
  categoryId?: string;
  name?: string;
  description?: string;
  basePrice?: number;
  preparationTime?: number;
  calories?: number;
  allergens?: string[];
  printerDestination?: PrinterDestination;
  imageUrl?: string;
  thumbnailUrl?: string;
  isAvailable?: boolean;
  isPopular?: boolean;
  displayOrder?: number;
}

export interface CreateModifierGroupData {
  menuItemId: string;
  name: string;
  description?: string;
  isRequired?: boolean;
  minSelections?: number;
  maxSelections?: number | null;
  displayOrder?: number;
}

export interface UpdateModifierGroupData {
  name?: string;
  description?: string;
  isRequired?: boolean;
  minSelections?: number;
  maxSelections?: number | null;
  displayOrder?: number;
}

export interface CreateModifierData {
  modifierGroupId: string;
  name: string;
  priceAdjustment?: number;
  isDefault?: boolean;
  isAvailable?: boolean;
  displayOrder?: number;
}

export interface UpdateModifierData {
  name?: string;
  priceAdjustment?: number;
  isDefault?: boolean;
  isAvailable?: boolean;
  displayOrder?: number;
}

// ============================================================================
// PUBLIC ENDPOINTS (CACHED)
// ============================================================================

/**
 * Get all active categories sorted by displayOrder
 * Includes item count per category
 * Cached for 5 minutes
 */
export async function getCategories() {
  const cached = menuCache.get(CACHE_KEYS.CATEGORIES);
  if (cached) {
    logger.debug('Categories from cache');
    return cached;
  }

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      displayOrder: true,
      imageUrl: true,
      _count: {
        select: { menuItems: true },
      },
    },
    orderBy: { displayOrder: 'asc' },
  });

  menuCache.set(CACHE_KEYS.CATEGORIES, categories);
  logger.debug('Categories cached', { count: categories.length });

  return categories;
}

/**
 * Get available menu items in a category
 * Includes modifierGroups with modifiers
 * Sort by displayOrder
 * Optional filter for popular items
 * Cached for 5 minutes
 */
export async function getCategoryItems(categoryId: string, popular?: boolean) {
  const cacheKey = popular
    ? `${CACHE_KEYS.categoryItems(categoryId)}_popular`
    : CACHE_KEYS.categoryItems(categoryId);

  const cached = menuCache.get(cacheKey);
  if (cached) {
    logger.debug('Category items from cache', { categoryId, popular });
    return cached;
  }

  const items = await prisma.menuItem.findMany({
    where: {
      categoryId,
      isAvailable: true,
      ...(popular && { isPopular: true }),
    },
    select: {
      id: true,
      name: true,
      description: true,
      basePrice: true,
      imageUrl: true,
      thumbnailUrl: true,
      preparationTime: true,
      calories: true,
      allergens: true,
      isPopular: true,
      displayOrder: true,
      modifierGroups: {
        select: {
          id: true,
          name: true,
          description: true,
          isRequired: true,
          minSelections: true,
          maxSelections: true,
          displayOrder: true,
          modifiers: {
            where: { isAvailable: true },
            select: {
              id: true,
              name: true,
              priceAdjustment: true,
              isDefault: true,
              displayOrder: true,
            },
            orderBy: { displayOrder: 'asc' },
          },
        },
        orderBy: { displayOrder: 'asc' },
      },
    },
    orderBy: { displayOrder: 'asc' },
  });

  menuCache.set(cacheKey, items);
  logger.debug('Category items cached', { categoryId, popular, count: items.length });

  return items;
}

/**
 * Get single menu item with full details
 * Includes all modifier groups and modifiers
 * Cached for 5 minutes
 */
export async function getItemById(itemId: string) {
  const cached = menuCache.get(CACHE_KEYS.item(itemId));
  if (cached) {
    logger.debug('Item from cache', { itemId });
    return cached;
  }

  const item = await prisma.menuItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      name: true,
      description: true,
      basePrice: true,
      imageUrl: true,
      thumbnailUrl: true,
      preparationTime: true,
      calories: true,
      allergens: true,
      isPopular: true,
      isAvailable: true,
      displayOrder: true,
      printerDestination: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      modifierGroups: {
        select: {
          id: true,
          name: true,
          description: true,
          isRequired: true,
          minSelections: true,
          maxSelections: true,
          displayOrder: true,
          modifiers: {
            where: { isAvailable: true },
            select: {
              id: true,
              name: true,
              priceAdjustment: true,
              isDefault: true,
              displayOrder: true,
            },
            orderBy: { displayOrder: 'asc' },
          },
        },
        orderBy: { displayOrder: 'asc' },
      },
    },
  });

  if (!item || !item.isAvailable) {
    return null;
  }

  menuCache.set(CACHE_KEYS.item(itemId), item);
  logger.debug('Item cached', { itemId });

  return item;
}

/**
 * Search items by name/description (case-insensitive)
 * Returns matching items across all categories
 * Limit 20 results
 * Cached for 5 minutes
 */
export async function searchItems(query: string) {
  const cacheKey = CACHE_KEYS.search(query);
  const cached = menuCache.get(cacheKey);
  if (cached) {
    logger.debug('Search results from cache', { query });
    return cached;
  }

  const items = await prisma.menuItem.findMany({
    where: {
      isAvailable: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
      basePrice: true,
      imageUrl: true,
      thumbnailUrl: true,
      preparationTime: true,
      calories: true,
      allergens: true,
      isPopular: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: 20,
    orderBy: { name: 'asc' },
  });

  menuCache.set(cacheKey, items);
  logger.debug('Search results cached', { query, count: items.length });

  return items;
}

/**
 * Get featured items (isPopular=true)
 * Limit 10 items
 * Cached for 5 minutes
 */
export async function getFeaturedItems() {
  const cached = menuCache.get(CACHE_KEYS.FEATURED_ITEMS);
  if (cached) {
    logger.debug('Featured items from cache');
    return cached;
  }

  const items = await prisma.menuItem.findMany({
    where: {
      isAvailable: true,
      isPopular: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
      basePrice: true,
      imageUrl: true,
      thumbnailUrl: true,
      preparationTime: true,
      calories: true,
      allergens: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: 10,
    orderBy: { displayOrder: 'asc' },
  });

  menuCache.set(CACHE_KEYS.FEATURED_ITEMS, items);
  logger.debug('Featured items cached', { count: items.length });

  return items;
}

// ============================================================================
// ADMIN - CATEGORY OPERATIONS
// ============================================================================

/**
 * Create new category
 * Invalidates cache
 */
export async function createCategory(data: CreateCategoryData) {
  const category = await prisma.category.create({
    data: {
      name: data.name,
      description: data.description,
      displayOrder: data.displayOrder ?? 0,
      imageUrl: data.imageUrl,
      isActive: data.isActive ?? true,
    },
  });

  invalidateMenuCache();
  logger.info('Category created', { categoryId: category.id, name: category.name });

  return category;
}

/**
 * Update category
 * Invalidates cache
 */
export async function updateCategory(categoryId: string, data: UpdateCategoryData) {
  const category = await prisma.category.update({
    where: { id: categoryId },
    data,
  });

  invalidateMenuCache();
  logger.info('Category updated', { categoryId, name: category.name });

  return category;
}

/**
 * Delete category
 * Soft delete (set isActive=false) if has items
 * Hard delete if no items
 * Invalidates cache
 */
export async function deleteCategory(categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      _count: {
        select: { menuItems: true },
      },
    },
  });

  if (!category) {
    throw new Error('Category not found');
  }

  if (category._count.menuItems > 0) {
    // Soft delete - has items
    await prisma.category.update({
      where: { id: categoryId },
      data: { isActive: false },
    });

    invalidateMenuCache();
    logger.info('Category soft deleted (has items)', {
      categoryId,
      name: category.name,
      itemCount: category._count.menuItems
    });

    return { deleted: false, softDelete: true };
  } else {
    // Hard delete - no items
    await prisma.category.delete({
      where: { id: categoryId },
    });

    invalidateMenuCache();
    logger.info('Category hard deleted', { categoryId, name: category.name });

    return { deleted: true, softDelete: false };
  }
}

// ============================================================================
// ADMIN - MENU ITEM OPERATIONS
// ============================================================================

/**
 * Create new menu item
 * Invalidates cache
 */
export async function createMenuItem(data: CreateMenuItemData) {
  const menuItem = await prisma.menuItem.create({
    data: {
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      basePrice: data.basePrice,
      preparationTime: data.preparationTime ?? 10,
      calories: data.calories,
      allergens: data.allergens ?? [],
      printerDestination: data.printerDestination ?? 'KITCHEN',
      imageUrl: data.imageUrl,
      thumbnailUrl: data.thumbnailUrl,
      isAvailable: data.isAvailable ?? true,
      isPopular: data.isPopular ?? false,
      displayOrder: data.displayOrder ?? 0,
    },
    include: {
      category: true,
    },
  });

  invalidateMenuCache();
  logger.info('Menu item created', { itemId: menuItem.id, name: menuItem.name });

  return menuItem;
}

/**
 * Update menu item
 * Invalidates cache
 */
export async function updateMenuItem(itemId: string, data: UpdateMenuItemData) {
  const menuItem = await prisma.menuItem.update({
    where: { id: itemId },
    data,
    include: {
      category: true,
    },
  });

  invalidateMenuCache();
  logger.info('Menu item updated', { itemId, name: menuItem.name });

  return menuItem;
}

/**
 * Delete menu item
 * Soft delete (set isAvailable=false)
 * Invalidates cache
 */
export async function deleteMenuItem(itemId: string) {
  const menuItem = await prisma.menuItem.update({
    where: { id: itemId },
    data: { isAvailable: false },
  });

  invalidateMenuCache();
  logger.info('Menu item soft deleted', { itemId, name: menuItem.name });

  return menuItem;
}

// ============================================================================
// ADMIN - MODIFIER GROUP OPERATIONS
// ============================================================================

/**
 * Create modifier group for a menu item
 * Invalidates cache
 */
export async function createModifierGroup(data: CreateModifierGroupData) {
  const modifierGroup = await prisma.modifierGroup.create({
    data: {
      menuItemId: data.menuItemId,
      name: data.name,
      description: data.description,
      isRequired: data.isRequired ?? false,
      minSelections: data.minSelections ?? 0,
      maxSelections: data.maxSelections,
      displayOrder: data.displayOrder ?? 0,
    },
  });

  invalidateMenuCache();
  logger.info('Modifier group created', {
    groupId: modifierGroup.id,
    name: modifierGroup.name,
    menuItemId: data.menuItemId
  });

  return modifierGroup;
}

/**
 * Update modifier group
 * Invalidates cache
 */
export async function updateModifierGroup(groupId: string, data: UpdateModifierGroupData) {
  const modifierGroup = await prisma.modifierGroup.update({
    where: { id: groupId },
    data,
  });

  invalidateMenuCache();
  logger.info('Modifier group updated', { groupId, name: modifierGroup.name });

  return modifierGroup;
}

/**
 * Delete modifier group
 * Hard delete (cascades to modifiers)
 * Invalidates cache
 */
export async function deleteModifierGroup(groupId: string) {
  const modifierGroup = await prisma.modifierGroup.delete({
    where: { id: groupId },
  });

  invalidateMenuCache();
  logger.info('Modifier group deleted', { groupId, name: modifierGroup.name });

  return modifierGroup;
}

// ============================================================================
// ADMIN - MODIFIER OPERATIONS
// ============================================================================

/**
 * Create modifier for a modifier group
 * Invalidates cache
 */
export async function createModifier(data: CreateModifierData) {
  const modifier = await prisma.modifier.create({
    data: {
      modifierGroupId: data.modifierGroupId,
      name: data.name,
      priceAdjustment: data.priceAdjustment ?? 0,
      isDefault: data.isDefault ?? false,
      isAvailable: data.isAvailable ?? true,
      displayOrder: data.displayOrder ?? 0,
    },
  });

  invalidateMenuCache();
  logger.info('Modifier created', {
    modifierId: modifier.id,
    name: modifier.name,
    groupId: data.modifierGroupId
  });

  return modifier;
}

/**
 * Update modifier
 * Invalidates cache
 */
export async function updateModifier(modifierId: string, data: UpdateModifierData) {
  const modifier = await prisma.modifier.update({
    where: { id: modifierId },
    data,
  });

  invalidateMenuCache();
  logger.info('Modifier updated', { modifierId, name: modifier.name });

  return modifier;
}

/**
 * Delete modifier
 * Hard delete
 * Invalidates cache
 */
export async function deleteModifier(modifierId: string) {
  const modifier = await prisma.modifier.delete({
    where: { id: modifierId },
  });

  invalidateMenuCache();
  logger.info('Modifier deleted', { modifierId, name: modifier.name });

  return modifier;
}

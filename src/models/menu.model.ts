/**
 * Menu Model Types
 *
 * Types and interfaces for menu-related data structures.
 */

import {
  Category,
  MenuItem,
  ModifierGroup,
  Modifier,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// CATEGORY TYPES
// ============================================================================

/**
 * Category creation data
 */
export interface CreateCategoryData {
  name: string;
  description?: string;
  slug?: string;
  imageUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

/**
 * Category update data
 */
export interface UpdateCategoryData {
  name?: string;
  description?: string;
  slug?: string;
  imageUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

/**
 * Category with item count
 */
export interface CategoryWithCount extends Category {
  _count: {
    items: number;
  };
}

/**
 * Category with items
 */
export interface CategoryWithItems extends Category {
  items: MenuItem[];
}

// ============================================================================
// MENU ITEM TYPES
// ============================================================================

/**
 * Menu item creation data
 */
export interface CreateMenuItemData {
  categoryId: string;
  name: string;
  description?: string;
  slug?: string;
  basePrice: number | Decimal;
  imageUrl?: string;
  thumbnailUrl?: string;
  isAvailable?: boolean;
  isActive?: boolean;
  calories?: number;
  allergens?: string[];
  sortOrder?: number;
  prepTimeMinutes?: number;
}

/**
 * Menu item update data
 */
export interface UpdateMenuItemData {
  categoryId?: string;
  name?: string;
  description?: string;
  slug?: string;
  basePrice?: number | Decimal;
  imageUrl?: string;
  thumbnailUrl?: string;
  isAvailable?: boolean;
  isActive?: boolean;
  calories?: number;
  allergens?: string[];
  sortOrder?: number;
  prepTimeMinutes?: number;
}

/**
 * Modifier group with modifiers
 */
export interface ModifierGroupWithModifiers extends ModifierGroup {
  modifiers: Modifier[];
}

/**
 * Menu item with full relations
 */
export interface MenuItemWithRelations extends MenuItem {
  category: Category;
  modifierGroups: ModifierGroupWithModifiers[];
}

/**
 * Menu item query filters
 */
export interface MenuItemFilters {
  categoryId?: string;
  search?: string;
  isAvailable?: boolean;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

/**
 * Menu item sort options
 */
export type MenuItemSortField = 'name' | 'basePrice' | 'createdAt' | 'sortOrder';
export type SortOrder = 'asc' | 'desc';

export interface MenuItemSort {
  field: MenuItemSortField;
  order: SortOrder;
}

// ============================================================================
// MODIFIER GROUP TYPES
// ============================================================================

/**
 * Modifier group creation data
 */
export interface CreateModifierGroupData {
  name: string;
  description?: string;
  minSelections?: number;
  maxSelections?: number;
  isRequired?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

/**
 * Modifier group update data
 */
export interface UpdateModifierGroupData {
  name?: string;
  description?: string;
  minSelections?: number;
  maxSelections?: number;
  isRequired?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

// ============================================================================
// MODIFIER TYPES
// ============================================================================

/**
 * Modifier creation data
 */
export interface CreateModifierData {
  modifierGroupId: string;
  name: string;
  priceAdjustment?: number | Decimal;
  isAvailable?: boolean;
  sortOrder?: number;
}

/**
 * Modifier update data
 */
export interface UpdateModifierData {
  name?: string;
  priceAdjustment?: number | Decimal;
  isAvailable?: boolean;
  sortOrder?: number;
}

// ============================================================================
// MENU ITEM MODIFIER GROUP TYPES
// ============================================================================

/**
 * Data for linking modifier group to menu item
 */
export interface LinkModifierGroupData {
  menuItemId: string;
  modifierGroupId: string;
}

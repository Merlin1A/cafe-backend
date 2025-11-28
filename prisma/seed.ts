/**
 * Database Seed Script for The Commissary
 *
 * Seeds the database with:
 * - Categories (Breakfast, Lunch, Dinner, Coffee, Tea, Shakes, Snacks)
 * - Menu items (3-5 per category)
 * - Modifier groups (Size, Milk, Add-ons, Temperature)
 * - Test users (admin and customer)
 */

import { PrismaClient, PrinterDestination } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // ============================================================================
  // USERS
  // ============================================================================

  console.log('👤 Creating users...');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@thecommissary.com' },
    update: {},
    create: {
      firebaseUid: 'admin-firebase-uid-001',
      email: 'admin@thecommissary.com',
      firstName: 'Admin',
      lastName: 'User',
      phone: '+1234567890',
      role: 'ADMIN',
    },
  });

  const customerUser = await prisma.user.upsert({
    where: { email: 'customer@test.com' },
    update: {},
    create: {
      firebaseUid: 'customer-firebase-uid-002',
      email: 'customer@test.com',
      firstName: 'Test',
      lastName: 'Customer',
      phone: '+1987654321',
      role: 'CUSTOMER',
    },
  });

  console.log(`✓ Created admin: ${adminUser.email}`);
  console.log(`✓ Created customer: ${customerUser.email}\n`);

  // ============================================================================
  // CATEGORIES
  // ============================================================================

  console.log('📂 Creating categories...');

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Breakfast' },
      update: {},
      create: {
        name: 'Breakfast',
        description: 'Start your day right with our delicious breakfast options',
        displayOrder: 1,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { name: 'Lunch' },
      update: {},
      create: {
        name: 'Lunch',
        description: 'Fresh and satisfying lunch selections',
        displayOrder: 2,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { name: 'Dinner' },
      update: {},
      create: {
        name: 'Dinner',
        description: 'Hearty dinner options for a perfect evening',
        displayOrder: 3,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { name: 'Coffee' },
      update: {},
      create: {
        name: 'Coffee',
        description: 'Artisanal coffee beverages made to perfection',
        displayOrder: 4,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { name: 'Tea' },
      update: {},
      create: {
        name: 'Tea',
        description: 'Premium tea selection served hot or iced',
        displayOrder: 5,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { name: 'Shakes' },
      update: {},
      create: {
        name: 'Shakes',
        description: 'Creamy shakes and smoothies',
        displayOrder: 6,
        isActive: true,
      },
    }),
    prisma.category.upsert({
      where: { name: 'Snacks' },
      update: {},
      create: {
        name: 'Snacks',
        description: 'Quick bites and treats',
        displayOrder: 7,
        isActive: true,
      },
    }),
  ]);

  console.log(`✓ Created ${categories.length} categories\n`);

  // ============================================================================
  // MENU ITEMS - BREAKFAST
  // ============================================================================

  console.log('🍳 Creating breakfast items...');

  const breakfastCategory = categories[0]!;

  const breakfastItems = await Promise.all([
    prisma.menuItem.create({
      data: {
        categoryId: breakfastCategory.id,
        name: 'Classic Breakfast Burrito',
        description: 'Scrambled eggs, bacon, cheese, potatoes, and salsa wrapped in a warm tortilla',
        basePrice: 8.95,
        isAvailable: true,
        isPopular: true,
        preparationTime: 12,
        calories: 620,
        allergens: ['eggs', 'dairy', 'gluten'],
        displayOrder: 1,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: breakfastCategory.id,
        name: 'Avocado Toast',
        description: 'Smashed avocado on sourdough with cherry tomatoes, feta, and microgreens',
        basePrice: 9.50,
        isAvailable: true,
        isPopular: true,
        preparationTime: 8,
        calories: 380,
        allergens: ['gluten', 'dairy'],
        displayOrder: 2,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: breakfastCategory.id,
        name: 'Blueberry Pancakes',
        description: 'Fluffy buttermilk pancakes with fresh blueberries and maple syrup',
        basePrice: 10.95,
        isAvailable: true,
        isPopular: false,
        preparationTime: 15,
        calories: 540,
        allergens: ['eggs', 'dairy', 'gluten'],
        displayOrder: 3,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: breakfastCategory.id,
        name: 'Greek Yogurt Parfait',
        description: 'Greek yogurt layered with granola, honey, and seasonal berries',
        basePrice: 7.50,
        isAvailable: true,
        isPopular: false,
        preparationTime: 5,
        calories: 320,
        allergens: ['dairy', 'nuts'],
        displayOrder: 4,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
  ]);

  console.log(`✓ Created ${breakfastItems.length} breakfast items`);

  // ============================================================================
  // MENU ITEMS - LUNCH
  // ============================================================================

  console.log('🥪 Creating lunch items...');

  const lunchCategory = categories[1]!;

  const lunchItems = await Promise.all([
    prisma.menuItem.create({
      data: {
        categoryId: lunchCategory.id,
        name: 'Turkey Club Sandwich',
        description: 'Triple-decker with turkey, bacon, lettuce, tomato, and mayo on toasted bread',
        basePrice: 11.95,
        isAvailable: true,
        isPopular: true,
        preparationTime: 10,
        calories: 680,
        allergens: ['gluten', 'dairy'],
        displayOrder: 1,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: lunchCategory.id,
        name: 'Caesar Salad',
        description: 'Crisp romaine, parmesan, croutons, and house-made Caesar dressing',
        basePrice: 9.95,
        isAvailable: true,
        isPopular: false,
        preparationTime: 8,
        calories: 420,
        allergens: ['dairy', 'gluten', 'fish'],
        displayOrder: 2,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: lunchCategory.id,
        name: 'Grilled Chicken Wrap',
        description: 'Grilled chicken, mixed greens, tomatoes, and ranch in a spinach tortilla',
        basePrice: 10.50,
        isAvailable: true,
        isPopular: true,
        preparationTime: 12,
        calories: 520,
        allergens: ['gluten', 'dairy'],
        displayOrder: 3,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: lunchCategory.id,
        name: 'Soup & Half Sandwich Combo',
        description: 'Cup of soup of the day with half sandwich of your choice',
        basePrice: 10.95,
        isAvailable: true,
        isPopular: false,
        preparationTime: 10,
        calories: 480,
        allergens: ['gluten', 'dairy'],
        displayOrder: 4,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
  ]);

  console.log(`✓ Created ${lunchItems.length} lunch items`);

  // ============================================================================
  // MENU ITEMS - DINNER
  // ============================================================================

  console.log('🍽️  Creating dinner items...');

  const dinnerCategory = categories[2]!;

  const dinnerItems = await Promise.all([
    prisma.menuItem.create({
      data: {
        categoryId: dinnerCategory.id,
        name: 'Grilled Salmon',
        description: 'Atlantic salmon with roasted vegetables and lemon butter sauce',
        basePrice: 18.95,
        isAvailable: true,
        isPopular: true,
        preparationTime: 20,
        calories: 620,
        allergens: ['fish', 'dairy'],
        displayOrder: 1,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: dinnerCategory.id,
        name: 'Pasta Primavera',
        description: 'Penne pasta with seasonal vegetables in garlic white wine sauce',
        basePrice: 14.95,
        isAvailable: true,
        isPopular: false,
        preparationTime: 15,
        calories: 580,
        allergens: ['gluten', 'dairy'],
        displayOrder: 2,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: dinnerCategory.id,
        name: 'BBQ Chicken Bowl',
        description: 'Grilled BBQ chicken over rice with black beans, corn, and avocado',
        basePrice: 13.95,
        isAvailable: true,
        isPopular: true,
        preparationTime: 15,
        calories: 720,
        allergens: ['dairy'],
        displayOrder: 3,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
  ]);

  console.log(`✓ Created ${dinnerItems.length} dinner items`);

  // ============================================================================
  // MENU ITEMS - COFFEE
  // ============================================================================

  console.log('☕ Creating coffee items...');

  const coffeeCategory = categories[3]!;

  const coffeeItems = await Promise.all([
    prisma.menuItem.create({
      data: {
        categoryId: coffeeCategory.id,
        name: 'Espresso',
        description: 'Rich and bold single or double shot',
        basePrice: 3.50,
        isAvailable: true,
        isPopular: true,
        preparationTime: 3,
        calories: 5,
        allergens: [],
        displayOrder: 1,
        printerDestination: PrinterDestination.BEVERAGE,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: coffeeCategory.id,
        name: 'Cappuccino',
        description: 'Espresso with steamed milk and velvety foam',
        basePrice: 4.95,
        isAvailable: true,
        isPopular: true,
        preparationTime: 5,
        calories: 120,
        allergens: ['dairy'],
        displayOrder: 2,
        printerDestination: PrinterDestination.BEVERAGE,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: coffeeCategory.id,
        name: 'Caramel Latte',
        description: 'Espresso with steamed milk and caramel syrup',
        basePrice: 5.50,
        isAvailable: true,
        isPopular: true,
        preparationTime: 5,
        calories: 250,
        allergens: ['dairy'],
        displayOrder: 3,
        printerDestination: PrinterDestination.BEVERAGE,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: coffeeCategory.id,
        name: 'Cold Brew',
        description: 'Smooth cold-brewed coffee served over ice',
        basePrice: 4.50,
        isAvailable: true,
        isPopular: false,
        preparationTime: 3,
        calories: 5,
        allergens: [],
        displayOrder: 4,
        printerDestination: PrinterDestination.BEVERAGE,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: coffeeCategory.id,
        name: 'Mocha',
        description: 'Espresso with chocolate, steamed milk, and whipped cream',
        basePrice: 5.75,
        isAvailable: true,
        isPopular: true,
        preparationTime: 5,
        calories: 290,
        allergens: ['dairy'],
        displayOrder: 5,
        printerDestination: PrinterDestination.BEVERAGE,
      },
    }),
  ]);

  console.log(`✓ Created ${coffeeItems.length} coffee items`);

  // ============================================================================
  // MENU ITEMS - TEA
  // ============================================================================

  console.log('🍵 Creating tea items...');

  const teaCategory = categories[4]!;

  const teaItems = await Promise.all([
    prisma.menuItem.create({
      data: {
        categoryId: teaCategory.id,
        name: 'Green Tea',
        description: 'Premium organic green tea',
        basePrice: 3.50,
        isAvailable: true,
        isPopular: false,
        preparationTime: 4,
        calories: 0,
        allergens: [],
        displayOrder: 1,
        printerDestination: PrinterDestination.BEVERAGE,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: teaCategory.id,
        name: 'Chai Latte',
        description: 'Spiced black tea with steamed milk and honey',
        basePrice: 4.95,
        isAvailable: true,
        isPopular: true,
        preparationTime: 5,
        calories: 180,
        allergens: ['dairy'],
        displayOrder: 2,
        printerDestination: PrinterDestination.BEVERAGE,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: teaCategory.id,
        name: 'Iced Peach Tea',
        description: 'Refreshing peach-flavored black tea served over ice',
        basePrice: 4.25,
        isAvailable: true,
        isPopular: true,
        preparationTime: 3,
        calories: 90,
        allergens: [],
        displayOrder: 3,
        printerDestination: PrinterDestination.BEVERAGE,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: teaCategory.id,
        name: 'Matcha Latte',
        description: 'Japanese matcha green tea with steamed milk',
        basePrice: 5.50,
        isAvailable: true,
        isPopular: false,
        preparationTime: 5,
        calories: 150,
        allergens: ['dairy'],
        displayOrder: 4,
        printerDestination: PrinterDestination.BEVERAGE,
      },
    }),
  ]);

  console.log(`✓ Created ${teaItems.length} tea items`);

  // ============================================================================
  // MENU ITEMS - SHAKES
  // ============================================================================

  console.log('🥤 Creating shake items...');

  const shakesCategory = categories[5]!;

  const shakeItems = await Promise.all([
    prisma.menuItem.create({
      data: {
        categoryId: shakesCategory.id,
        name: 'Chocolate Shake',
        description: 'Rich chocolate ice cream blended to perfection',
        basePrice: 6.50,
        isAvailable: true,
        isPopular: true,
        preparationTime: 4,
        calories: 520,
        allergens: ['dairy'],
        displayOrder: 1,
        printerDestination: PrinterDestination.BEVERAGE,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: shakesCategory.id,
        name: 'Strawberry Banana Smoothie',
        description: 'Fresh strawberries and banana blended with yogurt',
        basePrice: 6.95,
        isAvailable: true,
        isPopular: true,
        preparationTime: 4,
        calories: 280,
        allergens: ['dairy'],
        displayOrder: 2,
        printerDestination: PrinterDestination.BEVERAGE,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: shakesCategory.id,
        name: 'Vanilla Shake',
        description: 'Classic vanilla ice cream shake',
        basePrice: 6.50,
        isAvailable: true,
        isPopular: false,
        preparationTime: 4,
        calories: 480,
        allergens: ['dairy'],
        displayOrder: 3,
        printerDestination: PrinterDestination.BEVERAGE,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: shakesCategory.id,
        name: 'Green Power Smoothie',
        description: 'Spinach, kale, mango, pineapple, and coconut water',
        basePrice: 7.50,
        isAvailable: true,
        isPopular: false,
        preparationTime: 4,
        calories: 210,
        allergens: [],
        displayOrder: 4,
        printerDestination: PrinterDestination.BEVERAGE,
      },
    }),
  ]);

  console.log(`✓ Created ${shakeItems.length} shake items`);

  // ============================================================================
  // MENU ITEMS - SNACKS
  // ============================================================================

  console.log('🍪 Creating snack items...');

  const snacksCategory = categories[6]!;

  const snackItems = await Promise.all([
    prisma.menuItem.create({
      data: {
        categoryId: snacksCategory.id,
        name: 'Chocolate Chip Cookie',
        description: 'Freshly baked with premium chocolate chips',
        basePrice: 2.95,
        isAvailable: true,
        isPopular: true,
        preparationTime: 2,
        calories: 380,
        allergens: ['gluten', 'dairy', 'eggs'],
        displayOrder: 1,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: snacksCategory.id,
        name: 'Fruit Cup',
        description: 'Fresh seasonal fruit medley',
        basePrice: 4.50,
        isAvailable: true,
        isPopular: false,
        preparationTime: 3,
        calories: 120,
        allergens: [],
        displayOrder: 2,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: snacksCategory.id,
        name: 'Blueberry Muffin',
        description: 'House-made muffin loaded with blueberries',
        basePrice: 3.50,
        isAvailable: true,
        isPopular: true,
        preparationTime: 2,
        calories: 420,
        allergens: ['gluten', 'dairy', 'eggs'],
        displayOrder: 3,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
    prisma.menuItem.create({
      data: {
        categoryId: snacksCategory.id,
        name: 'Chips & Guacamole',
        description: 'House-made tortilla chips with fresh guacamole',
        basePrice: 5.95,
        isAvailable: true,
        isPopular: false,
        preparationTime: 3,
        calories: 320,
        allergens: [],
        displayOrder: 4,
        printerDestination: PrinterDestination.KITCHEN,
      },
    }),
  ]);

  console.log(`✓ Created ${snackItems.length} snack items\n`);

  // ============================================================================
  // MODIFIER GROUPS & MODIFIERS
  // ============================================================================

  console.log('🔧 Creating modifier groups and modifiers...');

  // Size modifier group for beverages
  const cappuccino = coffeeItems[1]!;
  const latte = coffeeItems[2]!;
  const mocha = coffeeItems[4]!;

  const sizeGroup = await prisma.modifierGroup.create({
    data: {
      menuItemId: cappuccino.id,
      name: 'Size',
      description: 'Choose your size',
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      displayOrder: 1,
      modifiers: {
        create: [
          {
            name: 'Small (12oz)',
            priceAdjustment: 0,
            isDefault: false,
            displayOrder: 1,
          },
          {
            name: 'Medium (16oz)',
            priceAdjustment: 0.75,
            isDefault: true,
            displayOrder: 2,
          },
          {
            name: 'Large (20oz)',
            priceAdjustment: 1.50,
            isDefault: false,
            displayOrder: 3,
          },
        ],
      },
    },
  });

  // Milk options for coffee drinks
  const milkGroup = await prisma.modifierGroup.create({
    data: {
      menuItemId: cappuccino.id,
      name: 'Milk Options',
      description: 'Choose your milk preference',
      isRequired: false,
      minSelections: 0,
      maxSelections: 1,
      displayOrder: 2,
      modifiers: {
        create: [
          {
            name: 'Whole Milk',
            priceAdjustment: 0,
            isDefault: true,
            displayOrder: 1,
          },
          {
            name: '2% Milk',
            priceAdjustment: 0,
            isDefault: false,
            displayOrder: 2,
          },
          {
            name: 'Oat Milk',
            priceAdjustment: 0.75,
            isDefault: false,
            displayOrder: 3,
          },
          {
            name: 'Almond Milk',
            priceAdjustment: 0.75,
            isDefault: false,
            displayOrder: 4,
          },
          {
            name: 'Soy Milk',
            priceAdjustment: 0.75,
            isDefault: false,
            displayOrder: 5,
          },
        ],
      },
    },
  });

  // Add-ons
  const addOnsGroup = await prisma.modifierGroup.create({
    data: {
      menuItemId: cappuccino.id,
      name: 'Add-ons',
      description: 'Customize your drink',
      isRequired: false,
      minSelections: 0,
      maxSelections: null, // unlimited
      displayOrder: 3,
      modifiers: {
        create: [
          {
            name: 'Extra Shot',
            priceAdjustment: 1.00,
            isDefault: false,
            displayOrder: 1,
          },
          {
            name: 'Whipped Cream',
            priceAdjustment: 0.50,
            isDefault: false,
            displayOrder: 2,
          },
          {
            name: 'Vanilla Syrup',
            priceAdjustment: 0.50,
            isDefault: false,
            displayOrder: 3,
          },
          {
            name: 'Caramel Drizzle',
            priceAdjustment: 0.50,
            isDefault: false,
            displayOrder: 4,
          },
        ],
      },
    },
  });

  // Temperature for certain drinks
  const coldBrew = coffeeItems[3]!;
  const temperatureGroup = await prisma.modifierGroup.create({
    data: {
      menuItemId: coldBrew.id,
      name: 'Temperature',
      description: 'Hot or iced',
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      displayOrder: 1,
      modifiers: {
        create: [
          {
            name: 'Iced',
            priceAdjustment: 0,
            isDefault: true,
            displayOrder: 1,
          },
          {
            name: 'Hot',
            priceAdjustment: 0,
            isDefault: false,
            displayOrder: 2,
          },
        ],
      },
    },
  });

  console.log(`✓ Created modifier groups with modifiers\n`);

  // ============================================================================
  // SUMMARY
  // ============================================================================

  console.log('═══════════════════════════════════════');
  console.log('✅ Database seed completed successfully!');
  console.log('═══════════════════════════════════════');
  console.log(`\n📊 Summary:`);
  console.log(`   • Users: 2 (1 admin, 1 customer)`);
  console.log(`   • Categories: ${categories.length}`);
  console.log(`   • Menu Items: ${
    breakfastItems.length +
    lunchItems.length +
    dinnerItems.length +
    coffeeItems.length +
    teaItems.length +
    shakeItems.length +
    snackItems.length
  }`);
  console.log(`   • Modifier Groups: 4`);
  console.log(`\n🔐 Test Credentials:`);
  console.log(`   Admin: admin@thecommissary.com`);
  console.log(`   Customer: customer@test.com\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

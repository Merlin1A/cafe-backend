/**
 * Application Configuration
 *
 * Centralized configuration management using environment variables.
 * All environment variables are validated on startup.
 */

import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

/**
 * Environment variable schema for validation
 */
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  // Database
  DATABASE_URL: z.string().url('Valid PostgreSQL connection string required'),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().min(1, 'Firebase project ID is required'),
  FIREBASE_PRIVATE_KEY: z.string().min(1, 'Firebase private key is required'),
  FIREBASE_CLIENT_EMAIL: z.string().email('Valid Firebase client email required'),
  FIREBASE_STORAGE_BUCKET: z.string().min(1, 'Firebase storage bucket is required'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().startsWith('sk_', 'Valid Stripe secret key required'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'Valid Stripe webhook secret required'),

  // Print Server
  PRINT_SERVER_API_KEY: z.string().optional(),
  PRINT_SERVER_URL: z.string().url().optional(),

  // Security
  ALLOWED_ORIGINS: z.string().default('capacitor://localhost,http://localhost'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Order Configuration
  DEFAULT_TAX_RATE: z.coerce.number().default(0.0825), // 8.25%
  MIN_ORDER_AMOUNT: z.coerce.number().default(5),
  MAX_ORDER_ITEMS: z.coerce.number().default(50),
  DEFAULT_PREP_TIME_MINUTES: z.coerce.number().default(15),

  // File Upload
  MAX_FILE_SIZE_MB: z.coerce.number().default(5),
  UPLOAD_DIRECTORY: z.string().default('uploads'),
});

/**
 * Validate and parse environment variables
 */
function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => `  - ${err.path.join('.')}: ${err.message}`);
      throw new Error(
        `Environment variable validation failed:\n${missingVars.join('\n')}\n\nPlease check your .env file.`
      );
    }
    throw error;
  }
}

// Validate environment variables on import
const env = validateEnv();

/**
 * Application configuration object
 */
export const config = {
  // Environment
  env: env.NODE_ENV,
  port: env.PORT,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  // Database
  database: {
    url: env.DATABASE_URL,
  },

  // Firebase
  firebase: {
    projectId: env.FIREBASE_PROJECT_ID,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle newlines in env
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
  },

  // Stripe
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    currency: 'usd',
  },

  // Print Server
  print: {
    apiKey: env.PRINT_SERVER_API_KEY,
    url: env.PRINT_SERVER_URL,
    enabled: !!env.PRINT_SERVER_API_KEY && !!env.PRINT_SERVER_URL,
  },

  // CORS
  cors: {
    origins: env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()),
  },

  // Logging
  logging: {
    level: env.LOG_LEVEL,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  // Order Configuration
  order: {
    taxRate: env.DEFAULT_TAX_RATE,
    minAmount: env.MIN_ORDER_AMOUNT,
    maxItems: env.MAX_ORDER_ITEMS,
    defaultPrepTimeMinutes: env.DEFAULT_PREP_TIME_MINUTES,
  },

  // File Upload
  upload: {
    maxSizeMB: env.MAX_FILE_SIZE_MB,
    maxSizeBytes: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    directory: env.UPLOAD_DIRECTORY,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
} as const;

export default config;

import { prisma } from '@/config/database';
import { auth, bucket } from '@/config/firebase';
import paymentService from '@/services/payment.service';
import logger from '@/utils/logger';

interface CheckResult {
  service: string;
  success: boolean;
  duration?: number;
  error?: string;
}

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_STORAGE_BUCKET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
] as const;

const ENV_FORMAT_VALIDATORS: Record<string, (value: string) => boolean> = {
  DATABASE_URL: (val) => val.startsWith('postgresql://'),
  STRIPE_SECRET_KEY: (val) => val.startsWith('sk_'),
};

async function validateEnvironmentVariables(): Promise<CheckResult> {
  const start = Date.now();
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];

    if (!value || value.trim() === '') {
      missing.push(varName);
      continue;
    }

    const validator = ENV_FORMAT_VALIDATORS[varName];
    if (validator && !validator(value)) {
      invalid.push(varName);
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    const errors: string[] = [];
    if (missing.length > 0) {
      errors.push(`Missing: ${missing.join(', ')}`);
    }
    if (invalid.length > 0) {
      errors.push(`Invalid format: ${invalid.join(', ')}`);
    }
    return {
      service: 'Environment variables',
      success: false,
      error: errors.join('; '),
    };
  }

  return {
    service: 'Environment variables',
    success: true,
    duration: Date.now() - start,
  };
}

async function testDatabaseConnection(): Promise<CheckResult> {
  const start = Date.now();

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    const queryPromise = prisma.$queryRaw`SELECT 1`;

    await Promise.race([queryPromise, timeoutPromise]);

    return {
      service: 'Database',
      success: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      service: 'Database',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function verifyFirebaseAdmin(): Promise<CheckResult> {
  const start = Date.now();

  try {
    if (!auth || !bucket) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    if (!auth.app || !bucket.name) {
      throw new Error('Firebase Admin SDK initialization incomplete');
    }

    return {
      service: 'Firebase Admin',
      success: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      service: 'Firebase Admin',
      success: false,
      error: error instanceof Error ? error.message : 'Initialization failed',
    };
  }
}

async function testStripeConnection(): Promise<CheckResult> {
  const start = Date.now();

  try {
    if (!(paymentService as any).stripe) {
      throw new Error('Stripe client not initialized');
    }

    return {
      service: 'Stripe API',
      success: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      service: 'Stripe API',
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

export async function verifyAllServices(): Promise<void> {
  const overallStart = Date.now();

  logger.info('Verifying services...');

  const results = await Promise.all([
    validateEnvironmentVariables(),
    testDatabaseConnection(),
    verifyFirebaseAdmin(),
    testStripeConnection(),
  ]);

  const failures = results.filter((r) => !r.success);

  if (failures.length > 0) {
    for (const failure of failures) {
      logger.error(`Service verification failed: ${failure.service}`, {
        error: failure.error,
      });
    }
    throw new Error('Service verification failed');
  }

  for (const result of results) {
    logger.info(`Service verified: ${result.service}`, {
      duration: result.duration,
    });
  }

  const totalDuration = Date.now() - overallStart;
  logger.info('All services verified successfully', {
    duration: totalDuration,
    services: results.map((r) => r.service),
  });
}

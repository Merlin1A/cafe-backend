/**
 * Database Configuration - Optimized for Neon PostgreSQL
 *
 * Implements Prisma Client singleton pattern with:
 * - Connection pooling for serverless environments
 * - Hot reload prevention in development
 * - Optimized settings for Neon's serverless driver
 * - Comprehensive error handling and logging
 */

import { PrismaClient } from '@prisma/client';
import logger from '@/utils/logger';

/**
 * Global type declaration for Prisma Client singleton
 * Prevents multiple instances during hot reloading in development
 */
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Validate DATABASE_URL is set
 */
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

/**
 * Prisma Client configuration optimized for Neon PostgreSQL
 *
 * Connection pooling settings:
 * - pool_timeout: 0 (no timeout for serverless)
 * - connection_limit: Conservative limit to prevent overwhelming Neon
 * - pgbouncer: true for Neon's connection pooler compatibility
 */
const prismaOptions = {
  // Logging configuration
  log:
    process.env.NODE_ENV === 'development'
      ? [
          { level: 'query' as const, emit: 'event' as const },
          { level: 'error' as const, emit: 'event' as const },
          { level: 'warn' as const, emit: 'event' as const },
        ]
      : [
          { level: 'error' as const, emit: 'event' as const },
        ],

  // Datasource configuration
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};

/**
 * Create or retrieve Prisma Client singleton instance
 *
 * In development: Reuses global instance to prevent hot reload issues
 * In production: Creates new instance for each deployment
 */
export const prisma = global.prisma || new PrismaClient(prismaOptions);

// Store instance globally in development to prevent multiple instances
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

/**
 * Event listeners for query logging and error tracking
 */

// Log queries in development for debugging
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: unknown) => {
    const event = e as { query: string; duration: number; params: string };
    logger.debug(`[Query] ${event.query} | Duration: ${event.duration}ms | Params: ${event.params}`);
  });
}

// Log errors in all environments
prisma.$on('error' as never, (e: unknown) => {
  const event = e as { message: string; target: string };
  logger.error(`[Prisma Error] ${event.message} | Target: ${event.target}`);
});

// Log warnings in all environments
prisma.$on('warn' as never, (e: unknown) => {
  const event = e as { message: string };
  logger.warn(`[Prisma Warning] ${event.message}`);
});

// Log info events in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('info' as never, (e: unknown) => {
    const event = e as { message: string };
    logger.info(`[Prisma Info] ${event.message}`);
  });
}

/**
 * Connect to database with retry logic
 *
 * Attempts to establish database connection with automatic retries.
 * Useful for handling temporary network issues or database startup delays.
 *
 * @param maxRetries - Maximum number of connection attempts (default: 5)
 * @param retryDelay - Delay between retries in ms (default: 2000)
 */
export async function connectDatabase(maxRetries = 5, retryDelay = 2000): Promise<void> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$connect();
      logger.info('✓ Database connected successfully');

      // Test connection with a simple query
      await prisma.$queryRaw`SELECT 1`;
      logger.info('✓ Database connection verified');

      return;
    } catch (error) {
      lastError = error as Error;
      logger.warn(
        `Database connection attempt ${attempt}/${maxRetries} failed: ${lastError.message}`
      );

      if (attempt < maxRetries) {
        logger.info(`Retrying in ${retryDelay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  logger.error('✗ Database connection failed after all retries');
  throw lastError!;
}

/**
 * Gracefully disconnect from database
 *
 * Closes all database connections and cleans up resources.
 * Should be called during application shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('✓ Database disconnected successfully');
  } catch (error) {
    logger.error('✗ Database disconnection failed:', error);
    throw error;
  }
}

/**
 * Database health check
 *
 * Verifies database connectivity by executing a simple query.
 * Returns true if database is accessible, false otherwise.
 *
 * @returns Promise<boolean> - Database health status
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Execute operations within a database transaction
 *
 * Provides automatic rollback on error and commit on success.
 * All operations within the transaction are executed atomically.
 *
 * @param fn - Async function containing database operations
 * @returns Result of the transaction
 *
 * @example
 * ```typescript
 * const result = await executeTransaction(async (tx) => {
 *   const user = await tx.user.create({ data: { ... } });
 *   const order = await tx.order.create({ data: { userId: user.id } });
 *   return { user, order };
 * });
 * ```
 */
export async function executeTransaction<T>(
  fn: (
    tx: Omit<
      PrismaClient,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >
  ) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn, {
    maxWait: 5000, // Maximum time to wait for a transaction slot (5s)
    timeout: 30000, // Maximum transaction execution time (30s)
  });
}

/**
 * Reset database sequence for autoincrement fields
 *
 * Useful for testing or when manually managing sequence values.
 * Neon PostgreSQL specific implementation.
 *
 * @param _tableName - Name of the table (reserved for future use)
 * @param sequenceName - Name of the sequence (usually table_column_seq)
 * @param startValue - Value to reset sequence to
 */
export async function resetSequence(
  _tableName: string,
  sequenceName: string,
  startValue: number = 1
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER SEQUENCE ${sequenceName} RESTART WITH ${startValue}`
    );
    logger.info(`✓ Sequence ${sequenceName} reset to ${startValue}`);
  } catch (error) {
    logger.error(`✗ Failed to reset sequence ${sequenceName}:`, error);
    throw error;
  }
}

/**
 * Get database connection pool statistics
 *
 * Returns information about active connections and pool usage.
 * Useful for monitoring and debugging connection issues.
 */
export async function getConnectionStats() {
  try {
    const result = await prisma.$queryRaw<
      Array<{ count: bigint }>
    >`SELECT COUNT(*) as count FROM pg_stat_activity WHERE datname = current_database()`;

    return {
      activeConnections: Number(result[0]?.count || 0),
      timestamp: new Date(),
    };
  } catch (error) {
    logger.error('Failed to get connection stats:', error);
    return null;
  }
}

/**
 * Clean up expired sessions or temporary data
 *
 * Can be called periodically to maintain database hygiene.
 * Customize based on your specific cleanup needs.
 */
export async function cleanupDatabase(): Promise<void> {
  try {
    // Example: Delete old print jobs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleted = await prisma.printJob.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
        status: {
          in: ['PRINTED', 'FAILED'],
        },
      },
    });

    logger.info(`✓ Database cleanup completed. Removed ${deleted.count} old print jobs.`);
  } catch (error) {
    logger.error('✗ Database cleanup failed:', error);
    throw error;
  }
}

export default prisma;

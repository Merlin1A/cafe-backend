/**
 * Server Entry Point
 *
 * Starts the Express server and manages lifecycle.
 * Handles database connections and graceful shutdown.
 */

import { createApp } from './app';
import { config } from '@/config';
import { connectDatabase, disconnectDatabase } from '@/config/database';
import logger from '@/utils/logger';
import { verifyAllServices } from '@/startup/healthCheck';

/**
 * Start the server
 */
async function startServer() {
  try {
    // Create Express app
    const app = createApp();

    // Connect to database
    logger.info('Connecting to database...');
    await connectDatabase();

    // Verify all services before accepting traffic
    await verifyAllServices();

    // Start listening
    const server = app.listen(config.port, () => {
      logger.info('=====================================');
      logger.info(`🚀 Server started successfully`);
      logger.info(`📍 Environment: ${config.env}`);
      logger.info(`🌐 Port: ${config.port}`);
      logger.info(`🔗 URL: http://localhost:${config.port}`);
      logger.info(`🏥 Health check: http://localhost:${config.port}/health`);
      logger.info(`📚 API base: http://localhost:${config.port}/api/v1`);
      logger.info('=====================================');
    });

    // ============================================================================
    // GRACEFUL SHUTDOWN
    // ============================================================================

    /**
     * Gracefully shutdown the server
     * Closes database connections and stops accepting new requests
     */
    async function gracefulShutdown(signal: string) {
      logger.info(`\n${signal} received, starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Disconnect from database
          await disconnectDatabase();
          logger.info('✓ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('✗ Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000); // 10 seconds
    }

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

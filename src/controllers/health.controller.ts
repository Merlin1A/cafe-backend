/**
 * Health Check Controller
 *
 * Provides system health status for monitoring.
 * Checks database and Firebase connectivity.
 */

import { Request, Response } from 'express';
import { prisma } from '@/config/database';
import { auth } from '@/config/firebase';
import logger from '@/utils/logger';
import packageJson from '../../package.json';

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: 'healthy' | 'unhealthy';
    firebase: 'healthy' | 'unhealthy';
  };
}

/**
 * Check database connectivity
 *
 * @returns True if database is accessible
 */
async function checkDatabase(): Promise<boolean> {
  try {
    // Simple SELECT 1 query
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed', { error });
    return false;
  }
}

/**
 * Check Firebase Admin SDK connectivity
 *
 * @returns True if Firebase is accessible
 */
async function checkFirebase(): Promise<boolean> {
  try {
    // Try to list 1 user to verify connection
    await auth.listUsers(1);
    return true;
  } catch (error) {
    logger.error('Firebase health check failed', { error });
    return false;
  }
}

/**
 * GET /health
 *
 * Health check endpoint
 * Returns 200 if healthy, 503 if degraded
 */
export async function getHealth(req: Request, res: Response): Promise<void> {
  try {
    // Run health checks in parallel
    const [databaseHealthy, firebaseHealthy] = await Promise.all([
      checkDatabase(),
      checkFirebase(),
    ]);

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    let statusCode: number;

    if (databaseHealthy && firebaseHealthy) {
      status = 'healthy';
      statusCode = 200;
    } else if (databaseHealthy || firebaseHealthy) {
      status = 'degraded';
      statusCode = 503; // Service Unavailable
    } else {
      status = 'unhealthy';
      statusCode = 503;
    }

    const response: HealthCheckResponse = {
      status,
      timestamp: new Date().toISOString(),
      version: packageJson.version,
      checks: {
        database: databaseHealthy ? 'healthy' : 'unhealthy',
        firebase: firebaseHealthy ? 'healthy' : 'unhealthy',
      },
    };

    logger.info('Health check completed', {
      status,
      database: databaseHealthy,
      firebase: firebaseHealthy,
    });

    res.status(statusCode).json(response);
  } catch (error) {
    logger.error('Health check failed', { error });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: packageJson.version,
      checks: {
        database: 'unhealthy',
        firebase: 'unhealthy',
      },
    });
  }
}

/**
 * GET /health/liveness
 *
 * Kubernetes liveness probe
 * Returns 200 if application is running
 */
export async function getLiveness(req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /health/readiness
 *
 * Kubernetes readiness probe
 * Returns 200 if application is ready to serve traffic
 */
export async function getReadiness(req: Request, res: Response): Promise<void> {
  try {
    // Check if database is accessible
    const databaseHealthy = await checkDatabase();

    if (databaseHealthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
    });
  }
}

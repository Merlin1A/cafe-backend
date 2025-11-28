/**
 * Health Check Routes
 *
 * Provides health check endpoints for monitoring and orchestration.
 * Includes basic health, liveness, and readiness probes.
 */

import { Router } from 'express';
import {
  getHealth,
  getLiveness,
  getReadiness,
} from '@/controllers/health.controller';

const router = Router();

/**
 * GET /health
 * Detailed health check with database and Firebase status
 */
router.get('/', getHealth);

/**
 * GET /health/liveness
 * Kubernetes liveness probe - is the app running?
 */
router.get('/liveness', getLiveness);

/**
 * GET /health/readiness
 * Kubernetes readiness probe - is the app ready to serve traffic?
 */
router.get('/readiness', getReadiness);

export default router;

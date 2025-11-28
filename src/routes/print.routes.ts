/**
 * Print Routes
 *
 * API endpoints for print job management.
 * Used by local Raspberry Pi print server.
 */

import { Router } from 'express';
import * as printController from '@/controllers/print.controller';
import { authenticate } from '@/middleware/auth';
import { requireAdmin } from '@/middleware/admin';
import { validateApiKey } from '@/middleware/apiKey';
import { readLimiter, writeLimiter } from '@/middleware/rateLimiter';

const router = Router();

// ============================================================================
// PRINT SERVER ENDPOINTS (API Key Authentication)
// ============================================================================

/**
 * GET /api/v1/print/jobs/pending
 *
 * Get pending print jobs
 * Returns jobs with receipt data and marks them as SENT
 *
 * Requires X-API-Key header
 */
router.get('/jobs/pending', validateApiKey, readLimiter, printController.getPendingJobs);

/**
 * POST /api/v1/print/jobs/:jobId/status
 *
 * Update print job status
 * Body: { status: 'PRINTED' | 'FAILED', error?: string }
 *
 * Requires X-API-Key header
 */
router.post('/jobs/:jobId/status', validateApiKey, writeLimiter, printController.updateJobStatus);

// ============================================================================
// ADMIN ENDPOINTS (User Authentication)
// ============================================================================

/**
 * POST /api/v1/print/jobs/:jobId/retry
 *
 * Manually retry a failed print job
 * Admin only
 */
router.post(
  '/jobs/:jobId/retry',
  authenticate,
  requireAdmin,
  writeLimiter,
  printController.retryJob
);

/**
 * POST /api/v1/print/jobs/retry-failed
 *
 * Retry all failed print jobs
 * Admin only
 */
router.post(
  '/jobs/retry-failed',
  authenticate,
  requireAdmin,
  writeLimiter,
  printController.retryFailedJobs
);

/**
 * GET /api/v1/print/jobs/stats
 *
 * Get print job statistics
 * Admin only
 */
router.get('/jobs/stats', authenticate, requireAdmin, readLimiter, printController.getJobStatistics);

export default router;

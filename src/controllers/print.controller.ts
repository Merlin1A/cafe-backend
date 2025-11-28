/**
 * Print Controller
 *
 * API endpoints for print job management.
 * Used by local print server to fetch and update print jobs.
 */

import { Request, Response } from 'express';
import printService from '@/services/print.service';
import logger from '@/utils/logger';

/**
 * Get pending print jobs
 * GET /api/v1/print/jobs/pending
 *
 * Returns pending jobs with receipt data
 * Marks jobs as SENT after returning
 *
 * Requires X-API-Key header
 */
export async function getPendingJobs(req: Request, res: Response): Promise<void> {
  try {
    const jobs = await printService.getPendingJobs();

    // Mark all jobs as sent
    const sentPromises = jobs.map((job) => printService.markJobSent(job.id));
    await Promise.all(sentPromises);

    // Return jobs with receipt data
    const jobsData = jobs.map((job) => ({
      id: job.id,
      printerType: job.printerType,
      receiptData: job.receiptData,
      orderId: job.orderId,
      createdAt: job.createdAt,
    }));

    logger.info('Pending jobs sent to print server', { count: jobsData.length });

    res.status(200).json({
      success: true,
      data: {
        jobs: jobsData,
      },
    });
  } catch (error) {
    logger.error('Failed to get pending jobs', { error });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch pending jobs',
        code: 'FETCH_ERROR',
      },
    });
  }
}

/**
 * Update print job status
 * POST /api/v1/print/jobs/:jobId/status
 *
 * Updates job status to PRINTED or FAILED
 * Body: { status: 'PRINTED' | 'FAILED', error?: string }
 *
 * Requires X-API-Key header
 */
export async function updateJobStatus(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const { status, error } = req.body;

    if (!status || !['PRINTED', 'FAILED'].includes(status)) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Status must be PRINTED or FAILED',
          code: 'INVALID_STATUS',
        },
      });
      return;
    }

    if (status === 'PRINTED') {
      await printService.markJobPrinted(jobId);

      logger.info('Print job marked as printed', { jobId });

      res.status(200).json({
        success: true,
        message: 'Job marked as printed',
      });
    } else if (status === 'FAILED') {
      if (!error) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Error message required for FAILED status',
            code: 'ERROR_REQUIRED',
          },
        });
        return;
      }

      await printService.markJobFailed(jobId, error);

      logger.error('Print job marked as failed', { jobId, error });

      res.status(200).json({
        success: true,
        message: 'Job marked as failed',
      });
    }
  } catch (error) {
    logger.error('Failed to update job status', { error });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update job status',
        code: 'UPDATE_ERROR',
      },
    });
  }
}

/**
 * Retry a failed print job
 * POST /api/v1/print/jobs/:jobId/retry
 *
 * Manually retry a failed job
 * Resets status to PENDING, clears error
 *
 * Admin endpoint
 */
export async function retryJob(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;

    await printService.retryJob(jobId);

    logger.info('Print job manually retried', { jobId });

    res.status(200).json({
      success: true,
      message: 'Job queued for retry',
    });
  } catch (error) {
    logger.error('Failed to retry job', { error });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retry job',
        code: 'RETRY_ERROR',
      },
    });
  }
}

/**
 * Retry all failed print jobs
 * POST /api/v1/print/jobs/retry-failed
 *
 * Retries all failed jobs with attempts < 3
 *
 * Admin endpoint
 */
export async function retryFailedJobs(req: Request, res: Response): Promise<void> {
  try {
    const count = await printService.retryFailedJobs();

    logger.info('Failed jobs retried', { count });

    res.status(200).json({
      success: true,
      data: {
        retriedCount: count,
      },
      message: `${count} job(s) queued for retry`,
    });
  } catch (error) {
    logger.error('Failed to retry failed jobs', { error });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retry jobs',
        code: 'RETRY_ERROR',
      },
    });
  }
}

/**
 * Get print job statistics
 * GET /api/v1/print/jobs/stats
 *
 * Returns job counts by status
 *
 * Admin endpoint
 */
export async function getJobStatistics(req: Request, res: Response): Promise<void> {
  try {
    const stats = await printService.getJobStatistics();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get job statistics', { error });

    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch statistics',
        code: 'FETCH_ERROR',
      },
    });
  }
}

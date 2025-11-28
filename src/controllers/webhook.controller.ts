/**
 * Webhook Controller
 *
 * Handles Stripe webhook events for payment processing.
 * Uses raw body parsing for signature verification.
 */

import { Request, Response } from 'express';
import paymentService from '@/services/payment.service';
import logger from '@/utils/logger';

/**
 * Handle Stripe webhook events
 * POST /api/v1/webhooks/stripe
 *
 * IMPORTANT: This endpoint requires raw body parsing (NOT JSON)
 * The raw body is needed for Stripe signature verification
 *
 * Events handled:
 * - payment_intent.succeeded: Update order paymentStatus to PAID
 * - payment_intent.payment_failed: Update order, log failure
 * - charge.refunded: Update order paymentStatus to REFUNDED
 * - charge.dispute.created: Log alert for admin
 */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  try {
    // Get Stripe signature from headers
    const signature = req.headers['stripe-signature'];

    if (!signature || typeof signature !== 'string') {
      logger.warn('Webhook received without signature');
      res.status(400).json({
        success: false,
        error: {
          message: 'Missing stripe-signature header',
          code: 'MISSING_SIGNATURE',
        },
      });
      return;
    }

    // Get raw body (must be Buffer for signature verification)
    const rawBody = req.body;

    if (!Buffer.isBuffer(rawBody)) {
      logger.error('Webhook body is not a Buffer', { type: typeof rawBody });
      res.status(400).json({
        success: false,
        error: {
          message: 'Invalid request body format',
          code: 'INVALID_BODY',
        },
      });
      return;
    }

    // Handle webhook event through payment service
    const result = await paymentService.handleWebhook(rawBody, signature);

    logger.info('Webhook processed successfully', {
      event: result.event,
      handled: result.handled,
    });

    // Respond with 200 to acknowledge receipt
    res.status(200).json({
      success: true,
      data: {
        event: result.event,
        handled: result.handled,
      },
    });
  } catch (error) {
    logger.error('Webhook processing failed', { error });

    // Check if it's a signature verification error
    if (error instanceof Error && error.message.includes('signature')) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Invalid webhook signature',
          code: 'INVALID_SIGNATURE',
        },
      });
      return;
    }

    // Return 500 for other errors
    res.status(500).json({
      success: false,
      error: {
        message: 'Webhook processing failed',
        code: 'WEBHOOK_ERROR',
      },
    });
  }
}

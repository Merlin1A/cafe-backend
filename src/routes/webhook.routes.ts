/**
 * Webhook Routes
 *
 * Handles webhook callbacks from external services.
 * Uses raw body parsing for signature verification.
 *
 * IMPORTANT: These routes must be registered BEFORE express.json() middleware
 * in app.ts to preserve the raw body for Stripe signature verification.
 */

import { Router } from 'express';
import express from 'express';
import * as webhookController from '@/controllers/webhook.controller';

const router = Router();

/**
 * POST /api/v1/webhooks/stripe
 *
 * Stripe webhook endpoint for payment events
 * Requires raw body parsing (NOT JSON) for signature verification
 * No authentication middleware (Stripe signature verification handles security)
 *
 * Events handled:
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 * - charge.refunded
 * - charge.dispute.created
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  webhookController.handleStripeWebhook
);

export default router;

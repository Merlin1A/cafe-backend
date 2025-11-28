/**
 * Express Application Setup
 *
 * Configures Express application with middleware, routes, and error handling.
 * This file contains the app configuration without starting the server.
 */

import express, { Application } from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { config } from '@/config';
import { morganStream } from '@/utils/logger';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { standardLimiter } from '@/middleware/rateLimiter';
import { securityHeaders } from '@/middleware/security';
import { sanitizeInput } from '@/middleware/sanitize';
import routes from '@/routes';
import healthRoutes from '@/routes/health.routes';
import webhookRoutes from '@/routes/webhook.routes';

/**
 * Create and configure Express application
 */
export function createApp(): Application {
  const app = express();

  // ============================================================================
  // 1. SECURITY HEADERS (HELMET)
  // ============================================================================

  /**
   * Helmet - Sets security-related HTTP headers
   * Includes CSP, HSTS, X-Frame-Options, and other security headers
   * Configured with Firebase Storage and Stripe allowlists
   */
  app.use(securityHeaders);

  // ============================================================================
  // 2. CORS
  // ============================================================================

  /**
   * CORS - Cross-Origin Resource Sharing
   * Configured for iOS Capacitor apps and allowed origins from env
   */
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        // Check if origin is in allowed list
        if (config.cors.origins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
      allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature'],
    })
  );

  // ============================================================================
  // TRUST PROXY (BEFORE RATE LIMITING)
  // ============================================================================

  /**
   * Trust proxy - Required for rate limiting and IP detection behind proxies
   * Enable in production for Heroku deployment
   */
  if (config.isProduction) {
    app.set('trust proxy', 1);
  }

  // ============================================================================
  // 3. RATE LIMITING
  // ============================================================================

  /**
   * Global rate limiter
   * Applies standard rate limits to all routes unless overridden
   * Route-specific limiters (auth, order) applied in route files
   */
  app.use(standardLimiter);

  // ============================================================================
  // 4. BODY PARSERS
  // ============================================================================

  /**
   * Webhook routes - MUST come before JSON body parser
   * Uses raw body parsing internally for Stripe signature verification
   */
  app.use('/api/v1/webhooks', webhookRoutes);

  /**
   * JSON body parser with size limit
   * Handles JSON payloads up to 10MB
   */
  app.use(express.json({ limit: '10mb' }));

  /**
   * URL-encoded body parser
   * Handles form submissions
   */
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ============================================================================
  // 5. INPUT SANITIZATION
  // ============================================================================

  /**
   * Sanitize user input to prevent XSS attacks
   * Recursively sanitizes req.body, req.query, and req.params
   */
  app.use(sanitizeInput);

  // ============================================================================
  // 6. LOGGING & COMPRESSION
  // ============================================================================

  /**
   * Compression - Compresses response bodies
   * Improves performance for large payloads
   */
  app.use(compression());

  /**
   * Morgan - HTTP request logger
   * Combined format in production, dev format in development
   */
  if (config.isDevelopment) {
    app.use(morgan('dev', { stream: morganStream }));
  } else {
    app.use(morgan('combined', { stream: morganStream }));
  }

  // ============================================================================
  // 7. ROUTES
  // ============================================================================

  /**
   * Health check routes
   * GET /health - Detailed health with database/Firebase checks
   * GET /health/liveness - Kubernetes liveness probe
   * GET /health/readiness - Kubernetes readiness probe
   */
  app.use('/health', healthRoutes);

  /**
   * API routes
   * Mount all API routes under /api/v1
   */
  app.use('/api/v1', routes);

  // ============================================================================
  // 8. ERROR HANDLING
  // ============================================================================

  /**
   * 404 Not Found handler
   * Catches all unmatched routes
   */
  app.use(notFoundHandler);

  /**
   * Global error handler
   * Catches and formats all errors with production-safe messages
   */
  app.use(errorHandler);

  return app;
}

export default createApp();

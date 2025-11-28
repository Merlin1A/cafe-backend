/**
 * Security Middleware
 *
 * Configures Helmet for security headers including:
 * - Content Security Policy (CSP)
 * - HTTP Strict Transport Security (HSTS)
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - And other security headers
 */

import helmet from 'helmet';
import { RequestHandler } from 'express';

/**
 * Helmet configuration with production-ready security headers
 *
 * CSP configured to allow:
 * - Firebase Storage images
 * - Stripe scripts (for payment processing)
 * - Self resources
 *
 * HSTS configured with:
 * - 1 year max-age
 * - includeSubDomains
 * - preload flag
 */
export const securityHeaders: RequestHandler = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],

      // Scripts: Allow self and Stripe
      scriptSrc: [
        "'self'",
        'https://js.stripe.com',
      ],

      // Styles: Allow self and inline styles (for some frameworks)
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for some CSS-in-JS solutions
      ],

      // Images: Allow self, data URLs, Firebase Storage, and Stripe
      imgSrc: [
        "'self'",
        'data:',
        'https:',
        'https://storage.googleapis.com',
        'https://firebasestorage.googleapis.com',
        'https://*.stripe.com',
      ],

      // Fonts: Allow self and data URLs
      fontSrc: [
        "'self'",
        'data:',
      ],

      // Connect: Allow self, Firebase, and Stripe
      connectSrc: [
        "'self'",
        'https://*.googleapis.com',
        'https://firebasestorage.googleapis.com',
        'https://api.stripe.com',
      ],

      // Frame: Allow Stripe for 3D Secure
      frameSrc: [
        "'self'",
        'https://js.stripe.com',
        'https://hooks.stripe.com',
      ],

      // Object and embed: Disallow
      objectSrc: ["'none'"],

      // Base URI: Restrict to self
      baseUri: ["'self'"],

      // Form action: Allow self
      formAction: ["'self'"],

      // Frame ancestors: Deny (prevent clickjacking)
      frameAncestors: ["'none'"],

      // Upgrade insecure requests in production
      upgradeInsecureRequests: [],
    },
  },

  // HTTP Strict Transport Security (HSTS)
  // Tells browsers to only connect via HTTPS for 1 year
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true, // Submit to HSTS preload list
  },

  // X-Frame-Options: Prevent clickjacking
  frameguard: {
    action: 'deny',
  },

  // X-Content-Type-Options: Prevent MIME sniffing
  noSniff: true,

  // X-Download-Options: Prevent IE from executing downloads
  ieNoOpen: true,

  // X-DNS-Prefetch-Control: Control DNS prefetching
  dnsPrefetchControl: {
    allow: false,
  },

  // X-Permitted-Cross-Domain-Policies: Restrict cross-domain policies
  permittedCrossDomainPolicies: {
    permittedPolicies: 'none',
  },

  // Referrer-Policy: Control referrer information
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  // Cross-Origin-Embedder-Policy
  crossOriginEmbedderPolicy: false, // Disabled for compatibility

  // Cross-Origin-Opener-Policy
  crossOriginOpenerPolicy: {
    policy: 'same-origin',
  },

  // Cross-Origin-Resource-Policy
  crossOriginResourcePolicy: {
    policy: 'cross-origin', // Allow cross-origin requests for API
  },

  // Origin-Agent-Cluster
  originAgentCluster: true,
});

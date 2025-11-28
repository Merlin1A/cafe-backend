/**
 * API Key Authentication Middleware
 *
 * Validates X-API-Key header for print server requests.
 * Used to authenticate local Raspberry Pi print server.
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '@/config';
import logger from '@/utils/logger';
import crypto from 'crypto';

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  return crypto.timingSafeEqual(bufferA, bufferB);
}

export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      logger.warn('API key missing from request', {
        ip: req.ip,
        path: req.path,
      });

      res.status(401).json({
        success: false,
        error: {
          message: 'API key required',
          code: 'API_KEY_REQUIRED',
        },
      });
      return;
    }

    if (!config.print.apiKey || !constantTimeCompare(apiKey, config.print.apiKey)) {
      logger.warn('Invalid API key', {
        ip: req.ip,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        error: {
          message: 'Invalid API key',
          code: 'INVALID_API_KEY',
        },
      });
      return;
    }

    logger.debug('API key validated successfully', {
      ip: req.ip,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.error('API key validation error', { error });

    res.status(500).json({
      success: false,
      error: {
        message: 'Authentication error',
        code: 'AUTH_ERROR',
      },
    });
  }
}

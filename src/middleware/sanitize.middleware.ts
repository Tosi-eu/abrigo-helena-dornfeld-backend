import { Request, Response, NextFunction } from 'express';
import { sanitizeObject } from '../infrastructure/helpers/sanitize.helper';

/**
 * Middleware to sanitize request body and query parameters
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query) as any;
  }

  next();
}

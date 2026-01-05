import { Request, Response, NextFunction } from 'express';
import { sanitizeObject } from '../infrastructure/helpers/sanitize.helper';

export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query) as typeof req.query;
  }

  next();
}

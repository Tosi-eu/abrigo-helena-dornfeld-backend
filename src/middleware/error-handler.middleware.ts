import { Request, Response, NextFunction } from 'express';
import { sanitizeErrorMessage } from '../infrastructure/helpers/sanitize.helper';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Error handler middleware that sanitizes error messages in production
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Log full error details (server-side only)
  if (!isProduction) {
    console.error('Error details:', err);
  } else {
    console.error('Error:', err.message || 'Internal server error');
  }

  // Don't expose internal error details in production
  const statusCode = err.statusCode || err.status || 500;
  const message = sanitizeErrorMessage(err, isProduction);

  res.status(statusCode).json({
    error: message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}

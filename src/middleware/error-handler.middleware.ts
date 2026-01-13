import { Request, Response } from 'express';
import { sanitizeErrorMessage } from '../infrastructure/helpers/sanitize.helper';
import { isAppError } from '../infrastructure/types/error.types';
import { logger } from '../infrastructure/helpers/logger.helper';

const isProduction = process.env.NODE_ENV === 'production';

export function errorHandler(err: unknown, req: Request, res: Response) {
  const errorMessage = err instanceof Error ? err.message : 'Internal server error';
  logger.error('Error handler', {
    operation: 'error_handler',
    path: req.path,
    method: req.method,
    statusCode: isAppError(err) ? (err.statusCode || err.status || 500) : 500,
  }, err instanceof Error ? err : new Error(errorMessage));

  const statusCode = isAppError(err)
    ? err.statusCode || err.status || 500
    : 500;
  const message = sanitizeErrorMessage(err, isProduction);
  const stack = err instanceof Error && !isProduction ? err.stack : undefined;

  res.status(statusCode).json({
    error: message,
    ...(stack ? { stack } : {}),
  });
}

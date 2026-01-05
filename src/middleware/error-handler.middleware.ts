import { Request, Response, NextFunction } from 'express';
import { sanitizeErrorMessage } from '../infrastructure/helpers/sanitize.helper';
import { AppError, isAppError } from '../infrastructure/types/error.types';

const isProduction = process.env.NODE_ENV === 'production';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!isProduction) {
    console.error('Error details:', err);
  } else {
    const message =
      err instanceof Error ? err.message : 'Internal server error';
    console.error('Error:', message);
  }

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

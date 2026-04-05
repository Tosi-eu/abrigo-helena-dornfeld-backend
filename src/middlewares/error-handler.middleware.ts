import { NextFunction, Request, Response } from 'express';
import { buildErrorJsonBody, getHttpErrorStatus } from '@helpers/error-response.helper';
import { logger } from '@helpers/logger.helper';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const errorMessage =
    err instanceof Error ? err.message : 'Internal server error';

  logger.error(
    'Error handler',
    {
      operation: 'error_handler',
      path: req.path,
      method: req.method,
      statusCode: getHttpErrorStatus(err),
    },
    err instanceof Error ? err : new Error(errorMessage),
  );

  const statusCode = getHttpErrorStatus(err);
  res.status(statusCode).json(buildErrorJsonBody(err));
}

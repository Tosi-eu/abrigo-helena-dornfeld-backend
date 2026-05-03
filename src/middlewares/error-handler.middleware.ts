import { NextFunction, Request, Response } from 'express';
import {
  buildErrorJsonBody,
  getHttpErrorStatus,
} from '@helpers/error-response.helper';
import { logger } from '@helpers/logger.helper';
import type { AuthRequest } from '@middlewares/auth.middleware';
import { getErrorEventService } from '@services/error-event.service';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const ar = req as AuthRequest;
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

  void getErrorEventService()
    .recordFromUnknown(err, {
      source: 'backend_http',
      httpMethod: req.method,
      httpPath: req.path,
      httpStatus: statusCode,
      correlationId: req.requestId,
      tenantId: ar.user?.tenantId ?? null,
    })
    .catch(() => undefined);
  res.status(statusCode).json(buildErrorJsonBody(err));
}

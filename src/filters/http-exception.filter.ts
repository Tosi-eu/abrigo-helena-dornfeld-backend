import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  buildErrorJsonBody,
  getHttpErrorStatus,
} from '@helpers/error-response.helper';
import { logger } from '@helpers/logger.helper';
import type { AuthRequest } from '@middlewares/auth.middleware';
import { getErrorEventService } from '@services/error-event.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<
      AuthRequest & { method?: string; path?: string; url?: string }
    >();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : getHttpErrorStatus(exception);

    logger.error(
      'Nest exception filter',
      {
        operation: 'nest_exception_filter',
        path: req?.path ?? req?.url,
        method: req?.method,
        statusCode: status,
      },
      exception instanceof Error ? exception : new Error(String(exception)),
    );

    void getErrorEventService()
      .recordFromUnknown(exception, {
        source: 'backend_http',
        httpMethod: req?.method,
        httpPath: req?.path ?? req?.url,
        httpStatus: status,
        correlationId: req.requestId,
        tenantId: req.user?.tenantId ?? null,
      })
      .catch(() => undefined);

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : typeof body === 'object' &&
              body !== null &&
              'message' in body &&
              typeof (body as { message: unknown }).message === 'string'
            ? (body as { message: string }).message
            : exception.message;
      res.status(status).json({ error: message });
      return;
    }

    res.status(status).json(buildErrorJsonBody(exception));
  }
}

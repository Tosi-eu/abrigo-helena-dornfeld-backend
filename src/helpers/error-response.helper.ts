import { Response } from 'express';
import { sanitizeErrorMessage } from './sanitize.helper';
import { mapPrismaToClientError, prismaErrorLogMeta } from './prisma-error.helper';
import { isAppError } from '@domain/error.types';
import { logger } from './logger.helper';

const isProduction = process.env.NODE_ENV === 'production';

export function getHttpErrorStatus(err: unknown): number {
  return isAppError(err) ? err.statusCode || err.status || 500 : 500;
}

export function buildErrorJsonBody(err: unknown): {
  error: string;
  stack?: string;
} {
  const message = sanitizeErrorMessage(err, isProduction);
  const stack = err instanceof Error && !isProduction ? err.stack : undefined;
  return {
    error: message,
    ...(stack ? { stack } : {}),
  };
}

export function mapErrorToStatusAndCode(
  error: unknown,
): { status: number; code?: string } {
  if (
    error instanceof Error &&
    error.message.startsWith('RELATORIO_EXCEDE_LIMITE')
  ) {
    return { status: 413, code: 'RELATORIO_EXCEDE_LIMITE' };
  }
  const mapped = mapPrismaToClientError(error);
  if (mapped) {
    return { status: mapped.status };
  }
  if (isAppError(error)) {
    return { status: error.statusCode ?? error.status ?? 500 };
  }
  return { status: 500 };
}

export function sendErrorResponse(
  res: Response,
  status: number,
  error: unknown,
  fallbackMessage: string,
  code?: string,
): Response {
  const prismaMapped = mapPrismaToClientError(error);

  logger.error(
    'Controller error',
    { operation: 'controller', ...prismaErrorLogMeta(error) },
    error instanceof Error ? error : new Error(String(error)),
  );

  if (prismaMapped) {
    return res.status(prismaMapped.status).json({ error: prismaMapped.message });
  }

  let finalStatus = status;
  if (isAppError(error) && (error.statusCode || error.status)) {
    finalStatus = Number(error.statusCode ?? error.status);
  }

  let clientMessage: string;
  if (code === 'RELATORIO_EXCEDE_LIMITE') {
    clientMessage = fallbackMessage;
  } else {
    const sanitized = sanitizeErrorMessage(error, isProduction);
    clientMessage =
      isProduction && sanitized === 'Erro ao processar solicitação'
        ? fallbackMessage
        : sanitized || fallbackMessage;
  }

  const body: { error: string; code?: string } = { error: clientMessage };
  if (code) body.code = code;
  return res.status(finalStatus).json(body);
}

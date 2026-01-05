import { Response } from 'express';
import { sanitizeErrorMessage } from './sanitize.helper';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Helper to send sanitized error responses
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  error: unknown,
  defaultMessage?: string,
) {
  const message = error
    ? sanitizeErrorMessage(error, isProduction)
    : defaultMessage || 'Erro ao processar solicitação';

  return res.status(statusCode).json({ error: message });
}


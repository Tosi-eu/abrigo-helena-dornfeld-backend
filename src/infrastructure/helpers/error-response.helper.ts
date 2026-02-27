import { Response } from 'express';
import { sanitizeErrorMessage } from './sanitize.helper';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Standard error response: { error: string, code?: string }.
 * Do not leak stack traces in production.
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  error: unknown,
  defaultMessage?: string,
  code?: string,
) {
  const message = error
    ? sanitizeErrorMessage(error, isProduction)
    : defaultMessage || 'Erro ao processar solicitação';

  const body: { error: string; code?: string } = { error: message };
  if (code) body.code = code;

  return res.status(statusCode).json(body);
}

/** Map known error messages to HTTP status and optional stable code. */
export function mapErrorToStatusAndCode(error: unknown): {
  status: number;
  code?: string;
} {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('RELATORIO_EXCEDE_LIMITE'))
    return { status: 413, code: 'RELATORIO_EXCEDE_LIMITE' };
  if (
    msg.includes('duplicate key') ||
    msg.includes('já cadastrado') ||
    msg.includes('Já existe')
  )
    return { status: 409, code: 'DUPLICATE' };
  if (
    msg.includes('não encontrado') ||
    msg.includes('Não encontrado') ||
    msg.includes('Residente não encontrado')
  )
    return { status: 404, code: 'NOT_FOUND' };
  if (msg.includes('obrigatória') || msg.includes('inválid'))
    return { status: 400, code: 'VALIDATION' };
  if (msg.includes('não autenticado') || msg.includes('autenticado'))
    return { status: 401, code: 'UNAUTHORIZED' };
  return { status: 500, code: 'INTERNAL_ERROR' };
}

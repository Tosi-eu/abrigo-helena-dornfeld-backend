import type { LogContext } from './logger.helper';
import {
  BaseError,
  DatabaseError,
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationError,
} from 'sequelize';

/** Metadados seguros para log (sem dados sensíveis). */
export function sequelizeErrorLogMeta(err: unknown): LogContext {
  if (!(err instanceof Error)) {
    return { errorKind: 'non_error', raw: String(err) };
  }

  const base: LogContext = {
    errorName: err.name,
    errorMessage: err.message,
  };

  if (err instanceof ValidationError) {
    return {
      ...base,
      sequelizeKind: 'ValidationError',
      validationErrors: err.errors.map(e => ({
        path: e.path,
        message: e.message,
      })),
    };
  }

  if (err instanceof UniqueConstraintError) {
    return {
      ...base,
      sequelizeKind: 'UniqueConstraintError',
      fields: err.fields,
    };
  }

  if (err instanceof ForeignKeyConstraintError) {
    return {
      ...base,
      sequelizeKind: 'ForeignKeyConstraintError',
      table: err.table,
      fields: err.fields,
    };
  }

  if (err instanceof DatabaseError) {
    const parent = err.parent as
      | { code?: string; detail?: string; constraint?: string }
      | undefined;
    return {
      ...base,
      sequelizeKind: 'DatabaseError',
      pgCode: parent?.code,
      pgDetail: parent?.detail,
      constraint: parent?.constraint,
    };
  }

  if (err instanceof BaseError) {
    return { ...base, sequelizeKind: err.name };
  }

  return base;
}

/**
 * Mapeia erro ORM → status HTTP + mensagem segura para o cliente.
 */
export function mapSequelizeToClientError(
  err: unknown,
): { status: number; message: string } | null {
  if (err instanceof ValidationError) {
    const first = err.errors[0];
    const msg =
      (first &&
        `${first.path ? `${String(first.path)}: ` : ''}${first.message}`) ||
      'Dados inválidos';
    return { status: 400, message: msg };
  }

  if (err instanceof UniqueConstraintError) {
    return { status: 409, message: 'Login já cadastrado' };
  }

  if (err instanceof ForeignKeyConstraintError) {
    return {
      status: 400,
      message:
        'Não foi possível concluir o cadastro: referência inválida (verifique o abrigo).',
    };
  }

  if (err instanceof DatabaseError) {
    const parent = err.parent as { code?: string } | undefined;
    const code = parent?.code;
    if (code === '23503') {
      return {
        status: 400,
        message:
          'Não foi possível concluir o cadastro: vínculo obrigatório ausente ou inválido.',
      };
    }
    if (code === '23505') {
      return { status: 409, message: 'Login já cadastrado' };
    }
  }

  return null;
}

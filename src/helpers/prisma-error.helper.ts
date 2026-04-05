import { Prisma } from '@prisma/client';
import type { LogContext } from './logger.helper';
import { getErrorMessage } from '@domain/error.types';

export function prismaErrorLogMeta(err: unknown): LogContext {
  if (!(err instanceof Error)) {
    return { errorKind: 'non_error', raw: String(err) };
  }

  const base: LogContext = {
    errorName: err.name,
    errorMessage: err.message,
  };

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      ...base,
      prismaKind: 'PrismaClientKnownRequestError',
      prismaCode: err.code,
      meta: err.meta,
    };
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      ...base,
      prismaKind: 'PrismaClientValidationError',
    };
  }

  return base;
}

export function isUniqueViolationError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return true;
  }
  const message = getErrorMessage(error);
  const err = error as { name?: string; original?: { code?: string } };
  return (
    message.includes('duplicate') || err?.original?.code === '23505'
  );
}

export function mapPrismaToClientError(
  err: unknown,
): { status: number; message: string } | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return { status: 409, message: 'Login já cadastrado' };
    }
    if (err.code === 'P2003') {
      return {
        status: 400,
        message:
          'Não foi possível concluir o cadastro: referência inválida (verifique o tenant).',
      };
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, message: 'Dados inválidos' };
  }

  return null;
}

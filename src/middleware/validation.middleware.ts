import { Request, Response, NextFunction } from 'express';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 10;
const MIN_PAGE = 1;

export interface ValidatedRequest extends Request {
  validated?: {
    page: number;
    limit: number;
  };
}

/**
 * Validates and sanitizes pagination parameters
 */
export function validatePagination(
  req: ValidatedRequest,
  res: Response,
  next: NextFunction,
) {
  const page = Math.max(MIN_PAGE, Number(req.query.page) || MIN_PAGE);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(req.query.limit) || DEFAULT_PAGE_SIZE),
  );

  req.validated = {
    page: Number.isNaN(page) ? MIN_PAGE : page,
    limit: Number.isNaN(limit) ? DEFAULT_PAGE_SIZE : limit,
  };

  next();
}

export function validateIdParam(
  req: ValidatedRequest,
  res: Response,
  next: NextFunction,
) {
  const id = Number(req.params.id);
  if (Number.isNaN(id) || id <= 0 || !Number.isInteger(id)) {
    return res.status(400).json({
      error: 'ID inválido. Deve ser um número inteiro positivo.',
    });
  }
  next();
}

export function validateEstoqueIdParam(
  req: ValidatedRequest,
  res: Response,
  next: NextFunction,
) {
  const estoque_id = Number(req.params.estoque_id);
  if (Number.isNaN(estoque_id) || estoque_id <= 0 || !Number.isInteger(estoque_id)) {
    return res.status(400).json({
      error: 'Estoque ID inválido. Deve ser um número inteiro positivo.',
    });
  }
  next();
}

export function validateNumeroParam(
  req: ValidatedRequest,
  res: Response,
  next: NextFunction,
) {
  const numero = Number(req.params.numero);
  if (Number.isNaN(numero) || numero <= 0 || !Number.isInteger(numero)) {
    return res.status(400).json({
      error: 'Número inválido. Deve ser um número inteiro positivo.',
    });
  }
  next();
}

/**
 * Validates numeric casela parameter
 */
export function validateCaselaParam(
  req: ValidatedRequest,
  res: Response,
  next: NextFunction,
) {
  const casela = Number(req.params.casela);
  if (Number.isNaN(casela) || casela <= 0 || !Number.isInteger(casela)) {
    return res.status(400).json({
      error: 'Casela inválida. Deve ser um número inteiro positivo.',
    });
  }
  next();
}

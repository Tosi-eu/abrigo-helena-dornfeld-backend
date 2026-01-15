export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .trim()
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '');
}

export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as T;
  }

  if (typeof obj === 'object') {
    const sanitized = {} as Record<string, unknown>;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject((obj as Record<string, unknown>)[key]);
      }
    }
    return sanitized as T;
  }

  return obj;
}

export function sanitizeErrorMessage(
  error: unknown,
  isProduction: boolean,
): string {
  if (!error) return 'Erro interno do servidor';

  if (error && typeof error === 'object' && 'name' in error) {
    if (error.name === 'SequelizeValidationError' || error.name === 'ValidationError') {
      const validationError = error as { errors?: Array<{ message?: string; path?: string }>; message?: string };
      if (validationError.errors && validationError.errors.length > 0) {
        const firstError = validationError.errors[0];
        return firstError.message || `Erro de validação no campo ${firstError.path || 'desconhecido'}`;
      }
      return validationError.message || 'Erro de validação';
    }

    if (error.name === 'SequelizeUniqueConstraintError') {
      const uniqueError = error as { errors?: Array<{ message?: string; path?: string }>; message?: string };
      if (uniqueError.errors && uniqueError.errors.length > 0) {
        const firstError = uniqueError.errors[0];
        const field = firstError.path || 'campo';
        return `Já existe uma categoria com este ${field === 'nome' ? 'nome' : field}`;
      }
      return 'Já existe uma categoria com este nome';
    }
  }

  const errorMessage = error instanceof Error ? error.message : String(error);

  if (isProduction) {
    const safeMessages = [
      'Login e senha obrigatórios',
      'Credenciais inválidas',
      'Não encontrado',
      'Dados obrigatórios ausentes',
      'Login já cadastrado',
      'Lote já existe',
      'Lotes devem ser únicos',
      'Lotes devem ser únicos entre medicamentos e insumos',
      'já existe um medicamento',
      'já existe outro medicamento',
      'combinação de nome',
      'Campos obrigatórios',
      'Quantidade inválida',
      'Casela é obrigatória',
      'Usuário não autenticado',
      'ValidationError',
      'SequelizeValidationError',
      'Já existe uma categoria',
      'Nome da categoria é obrigatório',
    ];

    if (safeMessages.some(safe => errorMessage.includes(safe))) {
      return errorMessage;
    }

    return 'Erro ao processar solicitação';
  }

  return errorMessage;
}

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

  const errorMessage = error instanceof Error ? error.message : String(error);

  if (isProduction) {
    const safeMessages = [
      'Login e senha obrigatórios',
      'Credenciais inválidas',
      'Não encontrado',
      'Dados obrigatórios ausentes',
      'Login já cadastrado',
    ];

    if (safeMessages.some(safe => errorMessage.includes(safe))) {
      return errorMessage;
    }

    return 'Erro ao processar solicitação';
  }

  return errorMessage;
}

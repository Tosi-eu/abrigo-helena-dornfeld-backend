/**
 * Sanitizes user input to prevent XSS attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers like onclick=
}

/**
 * Sanitizes an object recursively
 */
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

/**
 * Sanitizes error message for client response
 */
export function sanitizeErrorMessage(
  error: unknown,
  isProduction: boolean,
): string {
  if (!error) return 'Erro interno do servidor';

  const errorMessage = error instanceof Error ? error.message : String(error);

  // In production, don't expose internal error details
  if (isProduction) {
    // Only expose safe, user-friendly messages
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

    // Generic error for unknown issues
    return 'Erro ao processar solicitação';
  }

  // In development, show more details
  return errorMessage;
}

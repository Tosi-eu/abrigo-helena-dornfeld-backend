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
    const sanitized = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        (sanitized as any)[key] = sanitizeObject((obj as any)[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Sanitizes error message for client response
 */
export function sanitizeErrorMessage(
  error: any,
  isProduction: boolean,
): string {
  if (!error) return 'Erro interno do servidor';

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

    const message = error.message || String(error);
    if (safeMessages.some(safe => message.includes(safe))) {
      return message;
    }

    // Generic error for unknown issues
    return 'Erro ao processar solicitação';
  }

  // In development, show more details
  return error.message || String(error);
}

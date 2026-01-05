import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

export function auditLog(req: AuthRequest, res: Response, next: NextFunction) {
  const startTime = Date.now();

  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    const duration = Date.now() - startTime;
    logAuditEvent(req, res, body, duration);
    return originalJson(body);
  };

  next();
}

function logAuditEvent(
  req: AuthRequest,
  res: Response,
  responseBody: unknown,
  duration: number,
) {
  const userId = (req as AuthRequest).user?.id || 'anonymous';
  const method = req.method;
  const path = req.path;
  const statusCode = res.statusCode;
  const ip = req.ip || req.socket.remoteAddress;

  const sensitiveMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  const sensitivePaths = [
    '/login',
    '/reset-password',
    '/logout',
    '/estoque',
    '/movimentacoes',
    '/residentes',
  ];

  const isSensitive =
    sensitiveMethods.includes(method) ||
    sensitivePaths.some(pathPattern => path.includes(pathPattern));

  if (isSensitive) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId,
      method,
      path,
      statusCode,
      duration: `${duration}ms`,
      ip,
      userAgent: req.get('user-agent'),
      success: statusCode >= 200 && statusCode < 400,
    };

    console.log('[AUDIT]', JSON.stringify(logEntry));
  }
}

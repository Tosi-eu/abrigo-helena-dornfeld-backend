import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { logger } from '../infrastructure/helpers/logger.helper';
import AuditLogModel from '../infrastructure/database/models/audit-log.model';

const SENSITIVE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

function getOperationType(method: string): 'create' | 'update' | 'delete' {
  if (method === 'POST') return 'create';
  if (method === 'PUT' || method === 'PATCH') return 'update';
  if (method === 'DELETE') return 'delete';
  return 'update';
}

function getResource(path: string): string | null {
  const segments = path.split('/').filter(Boolean);
  return segments[0] ?? null;
}

export function auditLog(req: AuthRequest, res: Response, next: NextFunction) {
  const startTime = Date.now();

  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    const duration = Date.now() - startTime;
    logAuditEvent(req, res, duration);
    return originalJson(body);
  };

  next();
}

function logAuditEvent(req: AuthRequest, res: Response, duration: number) {
  const method = req.method;
  const path = req.path;
  const statusCode = res.statusCode;

  if (!SENSITIVE_METHODS.includes(method)) return;

  const userId = req.user?.id ?? null;
  const operation_type = getOperationType(method);
  const resource = getResource(path);

  const logEntry = {
    timestamp: new Date().toISOString(),
    userId,
    method,
    path,
    statusCode,
    duration: `${duration}ms`,
    ip: req.ip || req.socket?.remoteAddress,
    userAgent: req.get('user-agent'),
    success: statusCode >= 200 && statusCode < 400,
  };

  logger.logSecurity('Audit log', { ...logEntry, operation: 'audit' });

  AuditLogModel.create({
    user_id: userId,
    method,
    path,
    operation_type,
    resource,
    status_code: statusCode,
    duration_ms: duration,
  }).catch((err) => {
    logger.error('Audit log persist failed', {
      path,
      err: (err as Error).message,
    });
  });
}

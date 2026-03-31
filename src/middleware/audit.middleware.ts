import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import type { TenantRequest } from './tenant.middleware';
import { logger } from '../infrastructure/helpers/logger.helper';
import AuditLogModel from '../infrastructure/database/models/audit-log.model';
import { getOldValueForAudit } from './audit-old-value.helper';

const SENSITIVE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

function getOperationType(method: string): 'create' | 'update' | 'delete' {
  if (method === 'POST') return 'create';
  if (method === 'PUT' || method === 'PATCH') return 'update';
  if (method === 'DELETE') return 'delete';
  return 'update';
}

function getResource(path: string): string | null {
  const segments = path
    .replace(/^\/api\/v1/, '')
    .split('/')
    .filter(Boolean);
  return segments[0] ?? null;
}

function safeJsonObject(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value !== 'object') return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function auditLog(
  req: AuthRequest & TenantRequest,
  res: Response,
  next: NextFunction,
) {
  const startTime = Date.now();
  const rawPath = (req.originalUrl ?? req.url ?? req.path ?? '').split('?')[0];
  const pathForAudit = rawPath.replace(/^\/api\/v1/, '') || '/';

  let capturedOld: Record<string, unknown> | null = null;
  let capturedNew: unknown = null;
  let auditDone = false;
  let oldValuePromise: Promise<Record<string, unknown> | null> | null = null;

  const runAudit = async () => {
    if (auditDone) return;
    auditDone = true;

    if (oldValuePromise) {
      try {
        capturedOld = await oldValuePromise;
      } catch {
        capturedOld = null;
      }
    }

    const duration = Date.now() - startTime;
    logAuditEvent(req, res, duration, capturedOld, capturedNew, pathForAudit);
  };

  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    if (body != null && typeof body === 'object') capturedNew = body;
    void runAudit();
    return originalJson(body);
  };

  res.on('finish', () => {
    void runAudit();
  });

  if (
    SENSITIVE_METHODS.includes(req.method) &&
    ['PUT', 'PATCH', 'DELETE'].includes(req.method)
  ) {
    oldValuePromise = getOldValueForAudit(pathForAudit, req.method, req).catch(
      () => null,
    );
  }

  next();
}

function logAuditEvent(
  req: AuthRequest & TenantRequest,
  res: Response,
  duration: number,
  oldValue: Record<string, unknown> | null,
  newValue: unknown,
  pathForAudit: string,
) {
  const method = req.method;
  const path = req.originalUrl?.split('?')[0] ?? req.path;
  const statusCode = res.statusCode;

  if (!SENSITIVE_METHODS.includes(method)) return;

  const userId = req.user?.id ?? null;
  const tenantId = req.tenant?.id ?? null;
  const operation_type = getOperationType(method);
  const resource = getResource(pathForAudit || path);

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
    tenant_id: tenantId,
    method,
    path,
    operation_type,
    resource,
    status_code: statusCode,
    duration_ms: duration,
    old_value: safeJsonObject(oldValue),
    new_value: safeJsonObject(newValue),
  }).catch(err => {
    logger.error('Audit log persist failed', {
      path,
      err: (err as Error).message,
    });
  });
}

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import type { TenantRequest } from './tenant.middleware';
import { logger } from '@helpers/logger.helper';
import { prisma } from '@repositories/prisma';
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

function redactAuditBody(
  pathForAudit: string,
  body: unknown,
): Record<string, unknown> | null {
  const obj = safeJsonObject(body);
  if (!obj) return null;

  const base: Record<string, unknown> = {};

  for (const k of ['id', 'tenantId', 'tenant_id', 'casela', 'casela_id']) {
    if (k in obj) base[k] = obj[k];
  }

  if (/^\/tenant\/(?:config|branding)/.test(pathForAudit)) {
    if ('modulesConfigured' in obj)
      base.modulesConfigured = obj.modulesConfigured;
    if ('onboardingComplete' in obj)
      base.onboardingComplete = obj.onboardingComplete;
    if ('ok' in obj) base.ok = obj.ok;
  }

  base._redacted = true;
  return base;
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
    if (body != null && typeof body === 'object') {
      capturedNew = redactAuditBody(pathForAudit, body);
    }
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

  // Audit log deve ser persistido fora da transação de request (RLS/ALS),
  // senão o callback pode disparar após o commit e o tx estar fechado.
  prisma.auditLog
    .create({
      data: {
        user_id: userId,
        tenant_id: tenantId,
        method,
        path,
        operation_type,
        resource,
        status_code: statusCode,
        duration_ms: duration,
        old_value: redactAuditBody(pathForAudit, oldValue) as
          | object
          | undefined,
        new_value: redactAuditBody(pathForAudit, newValue) as
          | object
          | undefined,
      },
    })
    .catch(err => {
      logger.error('Audit log persist failed', {
        path,
        err: (err as Error).message,
      });
    });
}

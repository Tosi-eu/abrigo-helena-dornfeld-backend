import { Response } from 'express';
import { Connection } from '@temporalio/client';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { LoginService } from '@services/login.service';
import { MovementService } from '@services/movimentacao.service';
import { ReportService } from '@services/relatorio.service';
import { NotificationEventService } from '@services/notificacao.service';
import type { PrismaAuditRepository } from '@repositories/audit.repository';
import type { PrismaLoginLogRepository } from '@repositories/login-log.repository';
import type { PrismaSystemConfigRepository } from '@repositories/system-config.repository';
import { AuthRequest } from '@middlewares/auth.middleware';
import { type TenantRequest } from '@middlewares/tenant.middleware';
import { getErrorMessage } from '@domain/error.types';
import { withRootTransaction } from '@repositories/prisma';
import { getRedisClient } from '@config/redis.client';
import {
  envTemporalAddress,
  envTemporalTaskQueue,
  getTemporalClient,
} from '@temporal/client';
import {
  MovementPeriod,
  type GenerateReportParams,
} from '@services/relatorio.service';
import { toCSV, reportResultToArrays } from '@helpers/csv.helper';
import { EventStatus, NotificationEventType } from '@domain/notificacao.types';
import { validateDisplayConfigPatch } from '@helpers/ui-display.helper';
import { getDb } from '@repositories/prisma';
import type { SystemConfigService } from '@services/system-config.service';
import type { SystemConfigPatch } from '@domain/dto/system-config.dto';
import {
  filterNonRuntimeConfig,
  isRuntimeConfigKey,
} from '@domain/dto/system-config.dto';
import { logger } from '@helpers/logger.helper';
import type { AdminMetricsResponse } from '@stokio/sdk';
import { syncScheduledBackupSchedule } from '@temporal/scheduled-backup-schedule';

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

export class AdminController {
  constructor(
    private readonly loginService: LoginService,
    private readonly auditRepo: PrismaAuditRepository,
    private readonly movementService?: MovementService,
    private readonly loginLogRepo?: PrismaLoginLogRepository,
    private readonly reportService?: ReportService,
    private readonly systemConfigRepo?: PrismaSystemConfigRepository,
    private readonly notificationService?: NotificationEventService,
    private readonly systemConfigService?: SystemConfigService,
  ) {}

  /** Dependência opcional ausente: 503 (não 501) para alertar proxies/monitorização. */
  private adminServiceUnavailable(
    res: Response,
    serviceKey: string,
    message: string,
  ): Response {
    logger.warn('Admin: dependência opcional não injectada', {
      operation: 'admin_service_unavailable',
      service: serviceKey,
    });
    return res
      .status(503)
      .set('Retry-After', '120')
      .set('X-Stokio-Availability', 'unavailable')
      .json({
        error: message,
        code: 'SERVICE_UNAVAILABLE',
        service: serviceKey,
      });
  }

  private async isTenantOwner(
    tenantId: number,
    actorUserId: number,
  ): Promise<boolean> {
    const row = await getDb().login.findFirst({
      where: { id: actorUserId, tenant_id: tenantId },
      select: { is_tenant_owner: true },
    });
    return Boolean(row?.is_tenant_owner);
  }

  async listUsers(
    req: AuthRequest & TenantRequest,
    res: Response,
    tenantId: number,
  ) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const result = await this.loginService.listUsersPaginated(
        page,
        limit,
        tenantId,
      );
      return res.json(result);
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao listar usuários',
      });
    }
  }

  async createUser(
    req: AuthRequest & TenantRequest,
    res: Response,
    tenantId: number,
  ) {
    const body = req.body ?? {};
    const login = body.login;
    const password = body.password;
    const firstName = body.firstName;
    const lastName = body.lastName;
    const role = body.role;
    const permissions = body.permissions;

    if (!login || !password) {
      return res.status(400).json({ error: 'Login e senha são obrigatórios' });
    }

    const actor = req.user;
    if (!actor?.id) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    if (role === 'admin') {
      const owner = await this.isTenantOwner(tenantId, actor.id);
      if (!owner) {
        return res.status(403).json({
          error:
            'Apenas o administrador principal do abrigo pode criar outros administradores.',
        });
      }
    }

    const data: {
      login: string;
      password: string;
      first_name?: string;
      last_name?: string;
      role?: 'admin' | 'user';
      tenantId: number;

      permissions?: unknown;
    } = { login, password, tenantId };
    if (firstName !== undefined) data.first_name = firstName;
    if (lastName !== undefined) data.last_name = lastName;
    if (role !== undefined) {
      if (role !== 'admin' && role !== 'user') {
        return res.status(400).json({ error: 'Role deve ser admin ou user' });
      }
      data.role = role;
    }
    if (permissions !== undefined) {
      const p = permissions;
      if (typeof p !== 'object' || p === null || Array.isArray(p)) {
        return res
          .status(400)
          .json({ error: 'permissions deve ser um objeto' });
      }

      data.permissions = p as Record<string, unknown>;
    }

    try {
      const user = await this.loginService.createByAdmin(data);
      if (!user) {
        return res.status(500).json({ error: 'Erro ao criar usuário' });
      }
      return res.status(201).json(user);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      if (
        msg === 'duplicate key' ||
        msg === 'Usuário já cadastrado' ||
        msg?.includes('cadastrado')
      ) {
        return res.status(409).json({ error: 'Login já cadastrado' });
      }
      if (msg?.includes('Senha deve')) {
        return res.status(400).json({ error: msg });
      }
      return res.status(500).json({ error: msg || 'Erro ao criar usuário' });
    }
  }

  async updateUser(req: AuthRequest, res: Response, tenantId: number) {
    const userId = Number(req.params.id);
    const body = req.body ?? {};

    if (Number.isNaN(userId) || userId < 1) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const data: {
      first_name?: string;
      last_name?: string;
      login?: string;
      password?: string;
      role?: 'admin' | 'user';
      permissions?: Record<string, unknown>;
    } = {};
    if (body.firstName !== undefined) data.first_name = body.firstName;
    if (body.lastName !== undefined) data.last_name = body.lastName;
    if (body.login !== undefined) data.login = body.login;
    if (body.password !== undefined && body.password !== '')
      data.password = body.password;
    if (body.role !== undefined) {
      if (body.role !== 'admin' && body.role !== 'user') {
        return res.status(400).json({ error: 'Role deve ser admin ou user' });
      }
      data.role = body.role;
    }
    if (body.permissions !== undefined) {
      const p = body.permissions;
      if (typeof p !== 'object' || p === null || Array.isArray(p)) {
        return res
          .status(400)
          .json({ error: 'permissions deve ser um objeto' });
      }
      data.permissions = p as Record<string, unknown>;
    }

    try {
      const actor = req.user;
      if (!actor?.id) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const target = await getDb().login.findFirst({
        where: { id: userId, tenant_id: tenantId },
        select: { id: true, role: true },
      });
      if (!target) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const isOwner = await this.isTenantOwner(tenantId, actor.id);
      const triesToChangeAdminSurface =
        data.role !== undefined ||
        data.permissions !== undefined ||
        data.password !== undefined;

      if (target.role === 'admin' && !isOwner && triesToChangeAdminSurface) {
        return res.status(403).json({
          error:
            'Você não pode alterar permissões, papel ou senha de um administrador.',
        });
      }

      if (data.role === 'admin' && !isOwner) {
        return res.status(403).json({
          error:
            'Apenas o administrador principal do abrigo pode promover alguém a administrador.',
        });
      }

      const updated = await this.loginService.updateUserByAdmin(userId, data);
      if (!updated) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      return res.json(updated);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      if (msg === 'duplicate key') {
        return res.status(409).json({ error: 'Login já cadastrado' });
      }
      return res
        .status(500)
        .json({ error: msg || 'Erro ao atualizar usuário' });
    }
  }

  async deleteUser(req: AuthRequest, res: Response, tenantId: number) {
    const userId = Number(req.params.id);
    const actor = req.user;
    if (actor == null || actor.id == null) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }
    const adminId = actor.id;

    if (Number.isNaN(userId) || userId < 1) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const target = await getDb().login.findFirst({
      where: { id: userId, tenant_id: tenantId },
      select: { id: true, role: true },
    });
    if (!target) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (target.role === 'admin') {
      const isOwner = await this.isTenantOwner(tenantId, adminId);
      if (!isOwner) {
        return res.status(403).json({
          error:
            'Apenas o administrador principal do abrigo pode remover admins.',
        });
      }
    }

    const ok = await this.loginService.deleteUserByAdmin(userId, adminId);
    if (!ok) {
      return res.status(400).json({
        error: 'Não é possível excluir seu próprio usuário',
      });
    }
    return res.status(204).send();
  }

  async getInsights(req: AuthRequest, res: Response) {
    try {
      const days = Math.min(
        MAX_DAYS,
        Math.max(1, Number(req.query.days) || DEFAULT_DAYS),
      );
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const page = Math.max(1, Number(req.query.page) || 1);
      const offset = (page - 1) * limit;
      const operationType = req.query.operationType as
        | 'create'
        | 'update'
        | 'delete'
        | undefined;
      if (
        operationType &&
        !['create', 'update', 'delete'].includes(operationType)
      ) {
        return res.status(400).json({ error: 'operationType inválido' });
      }

      const resourceRaw = req.query.resource;
      const resourceFilter =
        typeof resourceRaw === 'string' && resourceRaw.trim()
          ? resourceRaw.trim()
          : undefined;
      const userIdRaw = req.query.userId;
      const userIdFilter =
        userIdRaw != null && userIdRaw !== '' ? Number(userIdRaw) : undefined;
      if (
        userIdFilter != null &&
        (!Number.isInteger(userIdFilter) || userIdFilter < 1)
      ) {
        return res.status(400).json({ error: 'userId inválido' });
      }

      const insights = await this.auditRepo.getInsights(
        startDate,
        endDate,
        limit,
        offset,
        operationType,
        resourceFilter,
        userIdFilter,
      );
      return res.json(insights);
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao buscar insights',
      });
    }
  }

  async getLoginLog(req: AuthRequest, res: Response) {
    if (!this.loginLogRepo) {
      return this.adminServiceUnavailable(
        res,
        'loginLog',
        'Log de acessos não disponível',
      );
    }
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const userId =
        req.query.userId != null ? Number(req.query.userId) : undefined;
      const login =
        typeof req.query.login === 'string'
          ? req.query.login.trim()
          : undefined;
      const success =
        req.query.success === 'true'
          ? true
          : req.query.success === 'false'
            ? false
            : undefined;
      const fromDate =
        typeof req.query.fromDate === 'string' && req.query.fromDate
          ? new Date(req.query.fromDate)
          : undefined;
      const toDate =
        typeof req.query.toDate === 'string' && req.query.toDate
          ? new Date(req.query.toDate)
          : undefined;
      if (fromDate && Number.isNaN(fromDate.getTime())) {
        return res.status(400).json({ error: 'fromDate inválido' });
      }
      if (toDate && Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ error: 'toDate inválido' });
      }
      const result = await this.loginLogRepo.list(page, limit, {
        userId,
        login,
        success,
        fromDate,
        toDate,
      });
      return res.json(result);
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao buscar log de acessos',
      });
    }
  }

  async getStockHistory(req: AuthRequest, res: Response) {
    if (!this.movementService) {
      return this.adminServiceUnavailable(
        res,
        'movement',
        'Serviço de movimentação não disponível',
      );
    }
    try {
      const lote = (req.query.lote as string)?.trim();
      const itemType = req.query.itemType as
        | 'medicamento'
        | 'insumo'
        | undefined;
      const itemId =
        req.query.itemId != null ? Number(req.query.itemId) : undefined;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

      if (lote) {
        const result = await this.movementService.getHistoryByLote(
          lote,
          page,
          limit,
        );
        return res.json(result);
      }
      if (itemType && itemId != null && !Number.isNaN(itemId)) {
        const result = await this.movementService.getHistoryByItemId(
          itemType,
          itemId,
          page,
          limit,
        );
        return res.json(result);
      }
      return res.status(400).json({
        error:
          'Informe (itemType + itemId) ou lote para consultar o histórico.',
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao buscar histórico de estoque',
      });
    }
  }

  async getExport(req: AuthRequest, res: Response) {
    if (!this.reportService) {
      return this.adminServiceUnavailable(
        res,
        'reportExport',
        'Exportação não disponível',
      );
    }
    try {
      const type = (req.query.type as string)?.trim();
      if (!type) {
        return res.status(400).json({ error: 'Parâmetro type é obrigatório' });
      }

      const periodo = req.query.periodo as MovementPeriod | undefined;
      const data = req.query.data as string | undefined;
      const data_inicial = req.query.data_inicial as string | undefined;
      const mes = req.query.mes as string | undefined;
      const data_final = req.query.data_final as string | undefined;
      const casela =
        req.query.casela != null ? Number(req.query.casela) : undefined;

      const params: Record<string, unknown> = {};
      if (casela != null && !Number.isNaN(casela)) params.casela = casela;
      if (periodo) params.periodo = periodo;
      if (data) params.data = data;
      if (data_inicial) params.data_inicial = data_inicial;
      if (data_final) params.data_final = data_final;
      if (mes) params.mes = mes;

      const result = await this.reportService.generateReport(
        type,
        params as GenerateReportParams,
      );

      const arrays = reportResultToArrays(result);
      if (arrays.length === 0) {
        return res.status(400).json({
          error: 'Nenhum dado para exportar para este tipo de relatório',
        });
      }

      const csv = toCSV(arrays[0] as Record<string, unknown>[]);
      const filename = `export-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.send('\uFEFF' + csv);
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      if (msg?.startsWith('RELATORIO_EXCEDE_LIMITE')) {
        return res.status(400).json({
          error: msg.replace(/^RELATORIO_EXCEDE_LIMITE:\s*/, ''),
        });
      }
      return res.status(500).json({
        error: msg || 'Erro ao exportar',
      });
    }
  }

  async getHealth(_req: AuthRequest, res: Response) {
    try {
      await getDb().$queryRaw(Prisma.sql`SELECT 1`);
      const redis = getRedisClient();
      const redisOk = redis ? (await redis.ping()) === 'PONG' : false;
      let lastBackupAt: string | null = null;
      if (this.systemConfigRepo) {
        lastBackupAt = await this.systemConfigRepo.get('last_backup_at');
      }
      return res.json({
        database: 'connected',
        redis: redisOk ? 'connected' : 'unavailable',
        lastBackupAt: lastBackupAt || null,
      });
    } catch (error: unknown) {
      return res.status(503).json({
        database: 'error',
        redis: 'unknown',
        error: getErrorMessage(error) || 'Erro ao verificar saúde',
      });
    }
  }

  async getInfraHealth(_req: AuthRequest, res: Response) {
    const checkedAt = new Date().toISOString();

    const temporalDisabled =
      String(process.env.ENABLE_TEMPORAL ?? '')
        .trim()
        .toLowerCase() === 'false';

    type Check = {
      status:
        | 'ok'
        | 'error'
        | 'degraded'
        | 'skipped'
        | 'disabled'
        | 'unavailable';
      latencyMs?: number;
      detail?: string;
      url?: string;
      httpStatus?: number;
    };

    let database: Check = { status: 'error', detail: 'not probed' };
    let redis: Check = { status: 'unavailable', detail: 'not probed' };

    try {
      const t0 = Date.now();
      await getDb().$queryRaw(Prisma.sql`SELECT 1`);
      database = { status: 'ok', latencyMs: Date.now() - t0 };
    } catch (err: unknown) {
      database = {
        status: 'error',
        detail: getErrorMessage(err) || 'database probe failed',
      };
    }

    try {
      const rc = getRedisClient();
      if (!rc) {
        redis = { status: 'unavailable', detail: 'Redis não configurado' };
      } else {
        const t0 = Date.now();
        const pong = await rc.ping();
        redis =
          pong === 'PONG'
            ? { status: 'ok', latencyMs: Date.now() - t0 }
            : {
                status: 'degraded',
                detail: `Resposta inesperada: ${String(pong)}`,
              };
      }
    } catch (err: unknown) {
      redis = {
        status: 'error',
        detail: getErrorMessage(err) || 'redis probe failed',
      };
    }

    let temporal: Check = { status: 'disabled', detail: 'not probed' };
    if (temporalDisabled) {
      temporal = {
        status: 'disabled',
        detail: 'ENABLE_TEMPORAL=false',
      };
    } else {
      let conn: Awaited<ReturnType<typeof Connection.connect>> | null = null;
      try {
        const t0 = Date.now();
        conn = await Connection.connect({
          address: envTemporalAddress(),
          connectTimeout: '4s',
        });
        temporal = { status: 'ok', latencyMs: Date.now() - t0 };
      } catch (err: unknown) {
        temporal = {
          status: 'error',
          detail: getErrorMessage(err) || 'Temporal indisponível',
        };
      } finally {
        if (conn) {
          await conn.close().catch(() => undefined);
        }
      }
    }

    const payload = {
      checkedAt,
      services: {
        database,
        redis,
        temporal,
      },
    };

    if (database.status === 'error') {
      return res.status(503).json(payload);
    }
    return res.json(payload);
  }

  async getBackupStatus(_req: AuthRequest, res: Response) {
    if (!this.systemConfigRepo) {
      return this.adminServiceUnavailable(
        res,
        'systemConfig',
        'Configurações não disponíveis',
      );
    }

    try {
      const [
        lastBackupAt,
        lastBackupStatus,
        lastBackupDurationMs,
        lastBackupSizeBytes,
        lastBackupError,
      ] = await Promise.all([
        this.systemConfigRepo.get('last_backup_at'),
        this.systemConfigRepo.get('last_backup_status'),
        this.systemConfigRepo.get('last_backup_duration_ms'),
        this.systemConfigRepo.get('last_backup_size_bytes'),
        this.systemConfigRepo.get('last_backup_error'),
      ]);

      return res.json({
        lastBackupAt: lastBackupAt || null,
        lastBackupStatus: lastBackupStatus || null,
        lastBackupDurationMs: lastBackupDurationMs
          ? Number(lastBackupDurationMs)
          : null,
        lastBackupSizeBytes: lastBackupSizeBytes
          ? Number(lastBackupSizeBytes)
          : null,
        lastBackupError: lastBackupError || null,
        retentionCount: Number(process.env.R2_RETENTION_COUNT) || null,
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao carregar status do backup',
      });
    }
  }

  async runBackupNow(_req: AuthRequest, res: Response) {
    const temporalDisabled =
      String(process.env.ENABLE_TEMPORAL ?? '')
        .trim()
        .toLowerCase() === 'false';
    if (temporalDisabled) {
      return res.status(503).json({
        error:
          'Temporal desativado (ENABLE_TEMPORAL). Ative o worker e o Temporal para backups.',
      });
    }

    try {
      const { client } = await getTemporalClient();
      const workflowId = `system-backup-manual:${crypto.randomUUID()}`;
      const handle = await client.workflow.start('systemBackupCronWorkflow', {
        taskQueue: envTemporalTaskQueue(),
        workflowId,
        args: [],
      });

      return res.status(202).json({
        accepted: true,
        workflowId,
        runId: handle.firstExecutionRunId,
        message:
          'Workflow de backup enfileirado no Temporal. Acompanhe o worker e o estado em backup/status.',
      });
    } catch (error: unknown) {
      const msg =
        getErrorMessage(error) || 'Erro ao iniciar workflow de backup';
      return res.status(500).json({ error: msg });
    }
  }

  async getDataQualitySummary(_req: AuthRequest, res: Response) {
    try {
      const db = getDb();
      const [
        negMedRows,
        negInpRows,
        missingLotMedRows,
        missingLotInpRows,
        orphanMovRows,
      ] = await Promise.all([
        db.$queryRaw<[{ count: bigint }]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count FROM estoque_medicamento WHERE quantidade < 0
          `),
        db.$queryRaw<[{ count: bigint }]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count FROM estoque_insumo WHERE quantidade < 0
          `),
        db.$queryRaw<[{ count: bigint }]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count FROM estoque_medicamento
            WHERE (lote IS NULL OR btrim(lote) = '') AND quantidade > 0
          `),
        db.$queryRaw<[{ count: bigint }]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count FROM estoque_insumo
            WHERE (lote IS NULL OR btrim(lote) = '') AND quantidade > 0
          `),
        db.$queryRaw<[{ count: bigint }]>(Prisma.sql`
            SELECT COUNT(*)::bigint AS count FROM movimentacao
            WHERE medicamento_id IS NULL AND insumo_id IS NULL
          `),
      ]);
      const negMedRow = negMedRows[0];
      const negInpRow = negInpRows[0];
      const missingLotMedRow = missingLotMedRows[0];
      const missingLotInpRow = missingLotInpRows[0];
      const orphanMovRow = orphanMovRows[0];

      const negMed = Number(negMedRow?.count) || 0;
      const negInp = Number(negInpRow?.count) || 0;
      const missingLotMed = Number(missingLotMedRow?.count) || 0;
      const missingLotInp = Number(missingLotInpRow?.count) || 0;
      const orphanMov = Number(orphanMovRow?.count) || 0;

      return res.json({
        negativeStock: { medicines: negMed, inputs: negInp },
        missingLot: { medicines: missingLotMed, inputs: missingLotInp },
        orphanMovements: orphanMov,
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao calcular qualidade de dados',
      });
    }
  }

  async listInconsistencies(req: AuthRequest, res: Response) {
    const type = String(req.query.type || '');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    try {
      const db = getDb();
      if (type === 'orphan_movements') {
        const rows = await db.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
          SELECT id, tipo, data, login_id, quantidade, setor, lote, destino
          FROM movimentacao
          WHERE medicamento_id IS NULL AND insumo_id IS NULL
          ORDER BY data DESC
          LIMIT ${limit} OFFSET ${offset}
        `);
        const totalRows = await db.$queryRaw<[{ total: bigint }]>(Prisma.sql`
          SELECT COUNT(*)::bigint AS total FROM movimentacao
          WHERE medicamento_id IS NULL AND insumo_id IS NULL
        `);
        const totalRow = totalRows[0];
        return res.json({
          data: rows,
          total: Number(totalRow?.total) || 0,
          page,
          limit,
        });
      }

      if (type === 'negative_stock') {
        const rows = await db.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
          SELECT 'medicamento' AS item_type, id, medicamento_id AS item_id, quantidade, setor, lote, validade
          FROM estoque_medicamento WHERE quantidade < 0
          UNION ALL
          SELECT 'insumo' AS item_type, id, insumo_id AS item_id, quantidade, setor, lote, validade
          FROM estoque_insumo WHERE quantidade < 0
          ORDER BY quantidade ASC
          LIMIT ${limit} OFFSET ${offset}
        `);
        const totalRows = await db.$queryRaw<[{ total: bigint }]>(Prisma.sql`
          SELECT (
            (SELECT COUNT(*) FROM estoque_medicamento WHERE quantidade < 0) +
            (SELECT COUNT(*) FROM estoque_insumo WHERE quantidade < 0)
          )::bigint AS total
        `);
        const totalRow = totalRows[0];
        return res.json({
          data: rows,
          total: Number(totalRow?.total) || 0,
          page,
          limit,
        });
      }

      if (type === 'missing_lot') {
        const rows = await db.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
          SELECT 'medicamento' AS item_type, id, medicamento_id AS item_id, quantidade, setor, lote, validade
          FROM estoque_medicamento WHERE (lote IS NULL OR btrim(lote) = '') AND quantidade > 0
          UNION ALL
          SELECT 'insumo' AS item_type, id, insumo_id AS item_id, quantidade, setor, lote, validade
          FROM estoque_insumo WHERE (lote IS NULL OR btrim(lote) = '') AND quantidade > 0
          ORDER BY validade ASC
          LIMIT ${limit} OFFSET ${offset}
        `);
        const totalRows = await db.$queryRaw<[{ total: bigint }]>(Prisma.sql`
          SELECT (
            (SELECT COUNT(*) FROM estoque_medicamento
             WHERE (lote IS NULL OR btrim(lote) = '') AND quantidade > 0) +
            (SELECT COUNT(*) FROM estoque_insumo
             WHERE (lote IS NULL OR btrim(lote) = '') AND quantidade > 0)
          )::bigint AS total
        `);
        const totalRow = totalRows[0];
        return res.json({
          data: rows,
          total: Number(totalRow?.total) || 0,
          page,
          limit,
        });
      }

      return res.status(400).json({
        error:
          'type inválido. Use: negative_stock | missing_lot | orphan_movements',
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao listar inconsistências',
      });
    }
  }

  async listMedicineDuplicates(req: AuthRequest, res: Response) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    try {
      const db = getDb();
      const rows = await db.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        WITH norm AS (
          SELECT
            lower(btrim(nome)) AS n_nome,
            lower(btrim(principio_ativo)) AS n_principio,
            lower(btrim(dosagem)) AS n_dosagem,
            lower(btrim(unidade_medida)) AS n_unidade,
            array_agg(id ORDER BY id) AS ids,
            COUNT(*)::int AS count
          FROM medicamento
          GROUP BY 1,2,3,4
          HAVING COUNT(*) > 1
        )
        SELECT * FROM norm
        ORDER BY count DESC, n_nome ASC
        LIMIT ${limit} OFFSET ${offset}
      `);
      const totalRows = await db.$queryRaw<[{ total: bigint }]>(Prisma.sql`
        WITH norm AS (
          SELECT 1
          FROM medicamento
          GROUP BY lower(btrim(nome)), lower(btrim(principio_ativo)), lower(btrim(dosagem)), lower(btrim(unidade_medida))
          HAVING COUNT(*) > 1
        )
        SELECT COUNT(*)::bigint AS total FROM norm
      `);
      const totalRow = totalRows[0];
      return res.json({
        data: rows,
        total: Number(totalRow?.total) || 0,
        page,
        limit,
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao listar possíveis duplicados',
      });
    }
  }

  async mergeMedicines(req: AuthRequest, res: Response) {
    const keepId = Number(req.body?.keepId);
    const mergeIds = Array.isArray(req.body?.mergeIds)
      ? (req.body.mergeIds as unknown[])
          .map(Number)
          .filter(n => !Number.isNaN(n))
      : [];

    if (!keepId || Number.isNaN(keepId) || keepId < 1) {
      return res.status(400).json({ error: 'keepId inválido' });
    }
    const idsToMerge = mergeIds.filter(id => id && id !== keepId);
    if (idsToMerge.length === 0) {
      return res.status(400).json({ error: 'mergeIds vazio' });
    }

    try {
      await withRootTransaction(async t => {
        await t.$executeRaw(Prisma.sql`
          UPDATE estoque_medicamento SET medicamento_id = ${keepId}
          WHERE medicamento_id IN (${Prisma.join(idsToMerge)})
        `);
        await t.$executeRaw(Prisma.sql`
          UPDATE movimentacao SET medicamento_id = ${keepId}
          WHERE medicamento_id IN (${Prisma.join(idsToMerge)})
        `);
        await t.$executeRaw(Prisma.sql`
          UPDATE notificacao SET medicamento_id = ${keepId}
          WHERE medicamento_id IN (${Prisma.join(idsToMerge)})
        `);
        await t.$executeRaw(Prisma.sql`
          DELETE FROM medicamento WHERE id IN (${Prisma.join(idsToMerge)})
        `);
      });

      return res.json({ message: 'Medicamentos mesclados com sucesso.' });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao mesclar medicamentos',
      });
    }
  }

  private canonicalUnit(u: string): string {
    const raw = (u || '').trim();
    if (!raw) return raw;
    const low = raw.toLowerCase();
    const map: Record<string, string> = {
      mg: 'mg',
      ml: 'ml',
      g: 'g',
      mcg: 'mcg',
      ui: 'UI',
      gts: 'gts',
      'mg/ml': 'mg/ml',
      'g/ml': 'g/ml',
      'mg/g': 'mg/g',
      'ui/g': 'UI/g',
      'ui/mg': 'UI/mg',
      'ui/ml': 'UI/ml',
    };
    return map[low] ?? raw;
  }

  async normalizeMedicineUnits(req: AuthRequest, res: Response) {
    const dryRun = req.body?.dryRun === true;
    try {
      const rows = await getDb().$queryRaw<
        { id: number; unidade_medida: string }[]
      >(Prisma.sql`SELECT id, unidade_medida FROM medicamento`);
      let updated = 0;
      const changes: Array<{ id: number; from: string; to: string }> = [];
      for (const row of rows) {
        const to = this.canonicalUnit(row.unidade_medida);
        if (to !== row.unidade_medida) {
          updated++;
          changes.push({ id: row.id, from: row.unidade_medida, to });
        }
      }

      if (!dryRun && changes.length > 0) {
        await withRootTransaction(async t => {
          for (const c of changes) {
            await t.$executeRaw(Prisma.sql`
              UPDATE medicamento SET unidade_medida = ${c.to} WHERE id = ${c.id}
            `);
          }
        });
      }

      return res.json({
        dryRun,
        updated,
        preview: changes.slice(0, 50),
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao normalizar unidades',
      });
    }
  }

  async getMetrics(_req: AuthRequest, res: Response) {
    try {
      const movementsThisMonth = this.movementService
        ? await this.movementService.countMovementsThisMonth()
        : 0;
      const activeUsersThisMonth = this.loginLogRepo
        ? await this.loginLogRepo.countActiveUsersThisMonth()
        : 0;
      const payload: AdminMetricsResponse = {
        movementsThisMonth,
        activeUsersThisMonth,
      };
      return res.json(payload);
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao carregar métricas',
      });
    }
  }

  async getActiveUsersThisMonth(req: AuthRequest, res: Response) {
    if (!this.loginLogRepo) {
      return this.adminServiceUnavailable(
        res,
        'loginLog',
        'Log de acessos não disponível',
      );
    }
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const result = await this.loginLogRepo.listActiveUsersThisMonth(
        page,
        limit,
      );
      return res.json(result);
    } catch (error: unknown) {
      return res.status(500).json({
        error:
          getErrorMessage(error) || 'Erro ao listar usuários ativos do mês',
      });
    }
  }

  async getMovementsThisMonth(req: AuthRequest, res: Response) {
    if (!this.movementService) {
      return this.adminServiceUnavailable(
        res,
        'movement',
        'Movimentações não disponíveis',
      );
    }
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const result = await this.movementService.listMovementsThisMonth(
        page,
        limit,
      );
      return res.json(result);
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao listar movimentações do mês',
      });
    }
  }

  async getConfig(_req: AuthRequest, res: Response) {
    if (!this.systemConfigRepo) {
      return this.adminServiceUnavailable(
        res,
        'systemConfig',
        'Configurações não disponíveis',
      );
    }
    try {
      const all = await this.systemConfigRepo.getAll();
      const display = filterNonRuntimeConfig(all);
      const system = this.systemConfigService?.get();
      if (system) {
        return res.json({ display, system });
      }
      return res.json({ display, system: null });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao carregar configurações',
      });
    }
  }

  async getNotifications(req: AuthRequest, res: Response) {
    if (!this.notificationService) {
      return this.adminServiceUnavailable(
        res,
        'notifications',
        'Notificações não disponíveis',
      );
    }
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
      const tipo = (req.query.tipo as string) || undefined;
      const status = (req.query.status as string) || undefined;
      const visto =
        req.query.visto === 'true'
          ? true
          : req.query.visto === 'false'
            ? false
            : undefined;
      const result = await this.notificationService.listForAdmin({
        page,
        limit,
        tipo: tipo as NotificationEventType | undefined,
        status: status as EventStatus | undefined,
        visto,
      });
      return res.json(result);
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao listar notificações',
      });
    }
  }

  async patchNotification(req: AuthRequest, res: Response, tenantId: number) {
    if (!this.notificationService) {
      return this.adminServiceUnavailable(
        res,
        'notifications',
        'Notificações não disponíveis',
      );
    }
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const body = req.body ?? {};
    const updates: { visto?: boolean; status?: EventStatus } = {};
    if (typeof body.visto === 'boolean') updates.visto = body.visto;
    if (
      typeof body.status === 'string' &&
      ['pending', 'sent', 'cancelled'].includes(body.status)
    ) {
      updates.status = body.status as EventStatus;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Envie visto e/ou status' });
    }
    try {
      const updated = await this.notificationService.update(
        tenantId,
        id,
        updates,
      );
      if (!updated)
        return res.status(404).json({ error: 'Notificação não encontrada' });
      return res.json(updated);
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao atualizar notificação',
      });
    }
  }

  async updateConfig(req: AuthRequest, res: Response) {
    if (!this.systemConfigRepo) {
      return this.adminServiceUnavailable(
        res,
        'systemConfig',
        'Configurações não disponíveis',
      );
    }
    const body = req.body ?? {};
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return res.status(400).json({ error: 'Body deve ser um objeto' });
    }

    const isV2 = 'display' in body || 'system' in body;

    const displayPatch: Record<string, string> = {};
    let systemPatch: SystemConfigPatch | undefined;

    if (isV2) {
      if (body.display != null) {
        if (typeof body.display !== 'object' || body.display === null) {
          return res.status(400).json({ error: 'display deve ser um objeto' });
        }
        for (const [key, value] of Object.entries(
          body.display as Record<string, unknown>,
        )) {
          if (typeof key !== 'string' || key.trim() === '') continue;
          if (isRuntimeConfigKey(key)) {
            return res.status(400).json({
              error: `Chave reservada em display: ${key}`,
            });
          }
          displayPatch[key.trim()] =
            value == null ? '' : String(value as string);
        }
      }
      if (body.system != null) {
        if (typeof body.system !== 'object' || body.system === null) {
          return res.status(400).json({ error: 'system deve ser um objeto' });
        }
        systemPatch = body.system as SystemConfigPatch;
      }
      for (const [key] of Object.entries(body)) {
        if (key === 'display' || key === 'system') continue;
        if (!isRuntimeConfigKey(key)) continue;
        return res.status(400).json({
          error:
            'Chaves runtime.* não são permitidas no corpo raiz; use { system: { ... } }.',
        });
      }
    } else {
      for (const [key, value] of Object.entries(body)) {
        if (typeof key !== 'string' || key.trim() === '') continue;
        if (isRuntimeConfigKey(key)) {
          return res.status(400).json({
            error:
              'Use o formato { display: {...}, system: {...} } para configuração runtime.',
          });
        }
        displayPatch[key.trim()] = value == null ? '' : String(value);
      }
    }

    const displayErr = validateDisplayConfigPatch(displayPatch);
    if (displayErr) {
      return res.status(400).json({ error: displayErr });
    }

    if (systemPatch?.scheduledBackup !== undefined) {
      const viaApiKey = Boolean(
        (req as AuthRequest & { adminConfigViaApiKey?: boolean })
          .adminConfigViaApiKey,
      );
      if (!req.user?.isSuperAdmin && !viaApiKey) {
        return res.status(403).json({
          error: 'Only super-admin can change the backup schedule.',
        });
      }
    }

    try {
      if (Object.keys(displayPatch).length > 0) {
        await this.systemConfigRepo.setMany(displayPatch);
      }
      if (systemPatch != null && Object.keys(systemPatch).length > 0) {
        if (!this.systemConfigService) {
          return this.adminServiceUnavailable(
            res,
            'systemConfigService',
            'SystemConfigService não disponível',
          );
        }
        await this.systemConfigService.update(systemPatch);
        if (systemPatch.scheduledBackup != null) {
          try {
            await syncScheduledBackupSchedule(
              this.systemConfigService.get().scheduledBackup,
            );
          } catch (e: unknown) {
            logger.warn(
              '[admin/config] Falha ao sincronizar schedule Temporal de backup (cron pode ficar desatualizado até ao próximo bootstrap)',
              {
                operation: 'sync_scheduled_backup_schedule',
                error: e instanceof Error ? e.message : String(e),
              },
            );
          }
        }
      }
      const all = await this.systemConfigRepo.getAll();
      const display = filterNonRuntimeConfig(all);
      const system = this.systemConfigService?.get() ?? null;
      return res.json({ display, system });
    } catch (error: unknown) {
      const msg = getErrorMessage(error);
      if (msg?.startsWith('Configuração inválida')) {
        return res.status(400).json({ error: msg });
      }
      return res.status(500).json({
        error: msg || 'Erro ao salvar configurações',
      });
    }
  }

  async restoreBackup(req: AuthRequest, res: Response): Promise<void> {
    const file = (
      req as unknown as { file?: { buffer: Buffer; originalname: string } }
    ).file;
    if (!file?.buffer?.length || !file.originalname) {
      res.status(400).json({
        error:
          'Envie o arquivo do dump (backup_*.sql.gz ou .sql) no campo "file".',
      });
      return;
    }

    const name = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const isGz = name.toLowerCase().endsWith('.gz');
    const ext = isGz ? '.sql.gz' : '.sql';
    const tmpPath = join(tmpdir(), `restore_${Date.now()}${ext}`);

    try {
      writeFileSync(tmpPath, file.buffer);
    } catch (err: unknown) {
      res.status(500).json({
        error: getErrorMessage(err) || 'Erro ao gravar arquivo temporário',
      });
      return;
    }

    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'estoque';
    const env = { ...process.env, PGPASSWORD: dbPassword };

    const cleanup = () => {
      try {
        if (existsSync(tmpPath)) unlinkSync(tmpPath);
      } catch {
        // no-op
      }
    };

    const onDone = (code: number, stderr: string, stdout: string) => {
      cleanup();
      if (code !== 0) {
        res.status(500).json({
          error:
            stderr?.trim() ||
            stdout?.trim() ||
            `Processo encerrou com código ${code}`,
        });
        return;
      }
      const sendSuccess = () => {
        res.status(200).json({
          message:
            'Dump restaurado com sucesso. O banco foi alimentado com o arquivo de backup.',
        });
      };
      if (this.systemConfigRepo) {
        this.systemConfigRepo
          .set('last_backup_at', new Date().toISOString())
          .then(sendSuccess)
          .catch((err: unknown) => {
            res.status(500).json({
              error: getErrorMessage(err) || 'Erro ao atualizar last_backup_at',
            });
          });
      } else {
        sendSuccess();
      }
    };

    const runRestore = () => {
      let stderr = '';
      let stdout = '';
      if (isGz) {
        const gunzip = spawn('gunzip', ['-c', tmpPath], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        const psql = spawn(
          'psql',
          [
            '-h',
            dbHost,
            '-p',
            dbPort,
            '-U',
            dbUser,
            '-d',
            dbName,
            '-v',
            'ON_ERROR_STOP=1',
          ],
          { env, stdio: ['pipe', 'pipe', 'pipe'] },
        );
        const psqlIn = psql.stdin;
        if (!psqlIn) {
          onDone(1, 'psql stdin indisponível', '');
          return;
        }
        gunzip.stdout.pipe(psqlIn);
        gunzip.stderr?.on('data', (d: Buffer) => {
          stderr += d.toString();
        });
        psql.stderr?.on('data', (d: Buffer) => {
          stderr += d.toString();
        });
        psql.stdout?.on('data', (d: Buffer) => {
          stdout += d.toString();
        });
        psql.on('close', (code, signal) => {
          onDone(code ?? (signal ? 1 : 0), stderr, stdout);
        });
      } else {
        const psql = spawn(
          'psql',
          [
            '-h',
            dbHost,
            '-p',
            dbPort,
            '-U',
            dbUser,
            '-d',
            dbName,
            '-v',
            'ON_ERROR_STOP=1',
            '-f',
            tmpPath,
          ],
          { env, stdio: ['ignore', 'pipe', 'pipe'] },
        );
        psql.stderr?.on('data', (d: Buffer) => {
          stderr += d.toString();
        });
        psql.stdout?.on('data', (d: Buffer) => {
          stdout += d.toString();
        });
        psql.on('close', (code, signal) => {
          onDone(code ?? (signal ? 1 : 0), stderr, stdout);
        });
      }
    };

    const truncateSql =
      "DO $$ DECLARE tbls text; BEGIN SELECT string_agg(quote_ident(tablename), ', ') INTO tbls FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('SequelizeMeta', '_prisma_migrations'); IF tbls IS NOT NULL AND tbls <> '' THEN EXECUTE 'TRUNCATE TABLE ' || tbls || ' RESTART IDENTITY CASCADE'; END IF; END $$;";
    let truncateStderr = '';
    const truncatePsql = spawn(
      'psql',
      [
        '-h',
        dbHost,
        '-p',
        dbPort,
        '-U',
        dbUser,
        '-d',
        dbName,
        '-v',
        'ON_ERROR_STOP=1',
        '-c',
        truncateSql,
      ],
      {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    truncatePsql.stderr?.on('data', (d: Buffer) => {
      truncateStderr += d.toString();
    });
    truncatePsql.on('close', (code, signal) => {
      if (code !== 0) {
        onDone(code ?? (signal ? 1 : 0), truncateStderr, '');
        return;
      }
      runRestore();
    });
  }
}

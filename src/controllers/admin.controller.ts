import { Response } from 'express';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, statSync } from 'fs';
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
  MovementPeriod,
  type GenerateReportParams,
} from '@services/relatorio.service';
import { toCSV, reportResultToArrays } from '@helpers/csv.helper';
import { EventStatus, NotificationEventType } from '@domain/notificacao.types';
import { validateDisplayConfigPatch } from '@helpers/ui-display.helper';
import { getDb } from '@repositories/prisma';

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
  ) {}

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
      /** Legado (4 flags) ou matriz `{ version: 2, resources, movement_tipos }`. */
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
      // Não normaliza aqui: o serviço aceita tanto o legado (4 flags) quanto v2.
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

      // Se está promovendo alguém a admin, só o owner pode.
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

      const insights = await this.auditRepo.getInsights(
        startDate,
        endDate,
        limit,
        offset,
        operationType,
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
      return res.status(501).json({ error: 'Log de acessos não disponível' });
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
      return res
        .status(501)
        .json({ error: 'Serviço de movimentação não disponível' });
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
      return res.status(501).json({ error: 'Exportação não disponível' });
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

  async getBackupStatus(_req: AuthRequest, res: Response) {
    if (!this.systemConfigRepo) {
      return res.status(501).json({ error: 'Configurações não disponíveis' });
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
    if (!this.systemConfigRepo) {
      return res.status(501).json({ error: 'Configurações não disponíveis' });
    }

    const startedAt = Date.now();
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'estoque';
    const env = { ...process.env, PGPASSWORD: dbPassword };

    const token = crypto.randomBytes(8).toString('hex');
    const tmpSql = join(tmpdir(), `admin_backup_${Date.now()}_${token}.sql`);
    const tmpGz = `${tmpSql}.gz`;

    const cleanup = () => {
      try {
        if (existsSync(tmpSql)) unlinkSync(tmpSql);
      } catch {
        // no-op
      }
      try {
        if (existsSync(tmpGz)) unlinkSync(tmpGz);
      } catch {
        // no-op
      }
    };

    const persistStatus = async (data: Record<string, string>) => {
      const repo = this.systemConfigRepo;
      if (!repo) return;
      await repo.setMany(data);
    };

    try {
      await new Promise<void>((resolve, reject) => {
        let stderr = '';
        const p = spawn(
          'pg_dump',
          [
            '-Fp',
            '--data-only',
            '-h',
            dbHost,
            '-p',
            dbPort,
            '-U',
            dbUser,
            dbName,
            '-f',
            tmpSql,
          ],
          { env, stdio: ['ignore', 'ignore', 'pipe'] },
        );
        p.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
        p.on('close', code => {
          if (code === 0) return resolve();
          reject(new Error(stderr.trim() || `pg_dump failed (code ${code})`));
        });
      });

      await new Promise<void>((resolve, reject) => {
        let stderr = '';
        const p = spawn('gzip', ['-f', tmpSql], {
          stdio: ['ignore', 'ignore', 'pipe'],
        });
        p.stderr?.on('data', (d: Buffer) => (stderr += d.toString()));
        p.on('close', code => {
          if (code === 0) return resolve();
          reject(new Error(stderr.trim() || `gzip failed (code ${code})`));
        });
      });

      const durationMs = Date.now() - startedAt;
      const sizeBytes = existsSync(tmpGz) ? Number(statSync(tmpGz).size) : null;

      await persistStatus({
        last_backup_at: new Date().toISOString(),
        last_backup_status: 'ok',
        last_backup_duration_ms: String(durationMs),
        ...(sizeBytes != null
          ? { last_backup_size_bytes: String(sizeBytes) }
          : {}),
        last_backup_error: '',
      });

      cleanup();

      return res.json({
        message: 'Backup gerado com sucesso.',
        durationMs,
        sizeBytes,
      });
    } catch (error: unknown) {
      const durationMs = Date.now() - startedAt;
      const msg = getErrorMessage(error) || 'Erro ao gerar backup';
      await persistStatus({
        last_backup_at: new Date().toISOString(),
        last_backup_status: 'error',
        last_backup_duration_ms: String(durationMs),
        last_backup_error: msg,
      }).catch(() => null);
      cleanup();
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
      return res.json({
        movementsThisMonth,
        activeUsersThisMonth,
      });
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao carregar métricas',
      });
    }
  }

  async getActiveUsersThisMonth(req: AuthRequest, res: Response) {
    if (!this.loginLogRepo) {
      return res.status(501).json({ error: 'Log de acessos não disponível' });
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
      return res.status(501).json({ error: 'Movimentações não disponíveis' });
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
      return res.status(501).json({ error: 'Configurações não disponíveis' });
    }
    try {
      const config = await this.systemConfigRepo.getAll();
      return res.json(config);
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao carregar configurações',
      });
    }
  }

  async getNotifications(req: AuthRequest, res: Response) {
    if (!this.notificationService) {
      return res.status(501).json({ error: 'Notificações não disponíveis' });
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
      return res.status(501).json({ error: 'Notificações não disponíveis' });
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
      return res.status(501).json({ error: 'Configurações não disponíveis' });
    }
    const body = req.body ?? {};
    if (typeof body !== 'object' || body === null) {
      return res.status(400).json({ error: 'Body deve ser um objeto' });
    }
    const config: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (typeof key !== 'string' || key.trim() === '') continue;
      config[key.trim()] = value == null ? '' : String(value);
    }
    const displayErr = validateDisplayConfigPatch(config);
    if (displayErr) {
      return res.status(400).json({ error: displayErr });
    }
    try {
      await this.systemConfigRepo.setMany(config);
      const updated = await this.systemConfigRepo.getAll();
      return res.json(updated);
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao salvar configurações',
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

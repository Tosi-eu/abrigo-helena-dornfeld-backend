import { Response } from 'express';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { LoginService } from '../../../core/services/login.service';
import { MovementService } from '../../../core/services/movimentacao.service';
import { ReportService } from '../../../core/services/relatorio.service';
import { NotificationEventService } from '../../../core/services/notificacao.service';
import { AuditRepository } from '../../database/repositories/audit.repository';
import { LoginLogRepository } from '../../database/repositories/login-log.repository';
import { SystemConfigRepository } from '../../database/repositories/system-config.repository';
import { AuthRequest } from '../../../middleware/auth.middleware';
import { getErrorMessage } from '../../types/error.types';
import { sequelize } from '../../database/sequelize';
import { getRedisClient } from '../../database/redis/client.redis';
import {
  MovementPeriod,
  type GenerateReportParams,
} from '../../../core/services/relatorio.service';
import { toCSV, reportResultToArrays } from '../../helpers/csv.helper';
import {
  EventStatus,
  NotificationEventType,
} from '../../database/models/notificacao.model';
import { validateDisplayConfigPatch } from '../../helpers/ui-display.helper';

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

export class AdminController {
  constructor(
    private readonly loginService: LoginService,
    private readonly auditRepo: AuditRepository,
    private readonly movementService?: MovementService,
    private readonly loginLogRepo?: LoginLogRepository,
    private readonly reportService?: ReportService,
    private readonly systemConfigRepo?: SystemConfigRepository,
    private readonly notificationService?: NotificationEventService,
  ) {}

  async listUsers(_req: AuthRequest, res: Response) {
    try {
      const users = await this.loginService.listAllUsers();
      return res.json(users);
    } catch (error: unknown) {
      return res.status(500).json({
        error: getErrorMessage(error) || 'Erro ao listar usuários',
      });
    }
  }

  async createUser(req: AuthRequest, res: Response) {
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

    const data: {
      login: string;
      password: string;
      first_name?: string;
      last_name?: string;
      role?: 'admin' | 'user';
      permissions?: {
        read?: boolean;
        create?: boolean;
        update?: boolean;
        delete?: boolean;
      };
    } = { login, password };
    if (firstName !== undefined) data.first_name = firstName;
    if (lastName !== undefined) data.last_name = lastName;
    if (role !== undefined) {
      if (role !== 'admin' && role !== 'user') {
        return res.status(400).json({ error: 'Role deve ser admin ou user' });
      }
      data.role = role;
    }
    if (
      permissions !== undefined &&
      typeof permissions === 'object' &&
      permissions !== null
    ) {
      data.permissions = {
        read: permissions.read !== false,
        create: Boolean(permissions.create),
        update: Boolean(permissions.update),
        delete: Boolean(permissions.delete),
      };
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

  async updateUser(req: AuthRequest, res: Response) {
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
      permissions?: {
        read?: boolean;
        create?: boolean;
        update?: boolean;
        delete?: boolean;
      };
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
      if (typeof p !== 'object' || p === null) {
        return res
          .status(400)
          .json({ error: 'permissions deve ser um objeto' });
      }
      data.permissions = {
        read: p.read !== false,
        create: Boolean(p.create),
        update: Boolean(p.update),
        delete: Boolean(p.delete),
      };
    }

    try {
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

  async deleteUser(req: AuthRequest, res: Response) {
    const userId = Number(req.params.id);
    const adminId = req.user!.id;

    if (Number.isNaN(userId) || userId < 1) {
      return res.status(400).json({ error: 'ID inválido' });
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
      await sequelize.authenticate();
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

  async patchNotification(req: AuthRequest, res: Response) {
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
      const updated = await this.notificationService.update(id, updates);
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
        /* ignore */
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
        gunzip.stdout.pipe(psql.stdin!);
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

    // Truncate all tables (except SequelizeMeta) so restore does not collide with existing data.
    const truncateSql =
      "DO $$ DECLARE tbls text; BEGIN SELECT string_agg(quote_ident(tablename), ', ') INTO tbls FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'SequelizeMeta'; IF tbls IS NOT NULL AND tbls <> '' THEN EXECUTE 'TRUNCATE TABLE ' || tbls || ' RESTART IDENTITY CASCADE'; END IF; END $$;";
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

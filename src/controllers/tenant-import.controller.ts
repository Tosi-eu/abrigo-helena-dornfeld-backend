import type { Request, Response } from 'express';
import type { AuthRequest } from '@middlewares/auth.middleware';
import type { TenantRequest } from '@middlewares/tenant.middleware';
import { TenantImportService } from '@services/tenant-import.service';
import { TenantPgDumpImportService } from '@services/tenant-pg-dump-import.service';
import { buildTenantImportTemplateBuffer } from '@helpers/tenant-import-template.excel';
import { prisma } from '@repositories/prisma';
import { Prisma } from '@prisma/client';
import { envTemporalTaskQueue, getTemporalClient } from '@temporal/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import crypto from 'node:crypto';

type UploadRequest = Request &
  AuthRequest &
  TenantRequest & { file?: Express.Multer.File } & {
    params?: { jobId?: string };
  };

export class TenantImportController {
  constructor(
    private readonly service: TenantImportService,
    private readonly pgDumpService: TenantPgDumpImportService,
  ) {}

  async importXlsx(req: UploadRequest, res: Response, tenantId: number) {
    const actorUserId = req.user?.id;
    if (!actorUserId) {
      return res.status(401).json({ error: 'Sessão inválida' });
    }

    const file = req.file;
    if (!file?.buffer || file.buffer.length === 0) {
      return res
        .status(400)
        .json({ error: 'Arquivo .xlsx obrigatório (campo file)' });
    }

    try {
      const result = await this.service.importXlsx({
        tenantId,
        actorUserId,
        fileBuffer: file.buffer,
      });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        error: (err as Error).message || 'Falha ao importar planilha',
      });
    }
  }

  async importXlsxAsync(req: UploadRequest, res: Response, tenantId: number) {
    const actorUserId = req.user?.id;
    if (!actorUserId) {
      return res.status(401).json({ error: 'Sessão inválida' });
    }

    const file = req.file;
    if (!file?.buffer || file.buffer.length === 0) {
      return res
        .status(400)
        .json({ error: 'Arquivo .xlsx obrigatório (campo file)' });
    }

    const uploadDir =
      process.env.IMPORT_UPLOAD_DIR?.trim() || '/var/lib/abrigo-imports';
    await mkdir(uploadDir, { recursive: true });
    const jobId = crypto.randomUUID();
    const filePath = join(uploadDir, `${jobId}.xlsx`);
    await writeFile(filePath, file.buffer);

    await prisma.tenantImportJob.create({
      data: {
        id: jobId,
        tenant_id: tenantId,
        actor_user_id: actorUserId,
        kind: 'xlsx',
        status: 'queued',
        file_path: filePath,
      },
    });

    const workflowId = `tenant:${tenantId}:import:${jobId}`;
    const { client } = await getTemporalClient();
    await client.workflow.start('tenantImportJobWorkflow', {
      taskQueue: envTemporalTaskQueue(),
      workflowId,
      args: [jobId],
    });

    return res.status(202).json({ jobId, workflowId, accepted: true });
  }

  async importPgDump(req: UploadRequest, res: Response, tenantId: number) {
    const actorUserId = req.user?.id;
    if (!actorUserId) {
      return res.status(401).json({ error: 'Sessão inválida' });
    }

    const file = req.file;
    if (!file?.buffer || file.buffer.length === 0) {
      return res
        .status(400)
        .json({ error: 'Arquivo obrigatório (campo file: .sql ou .sql.gz)' });
    }

    const q = req.query as Record<string, string | undefined>;
    const replaceTenantData =
      q.replaceTenantData === '1' ||
      q.replaceTenantData === 'true' ||
      q.replace === '1';
    const birthDateFallback =
      typeof q.birthDateFallback === 'string' && q.birthDateFallback.trim()
        ? q.birthDateFallback.trim()
        : undefined;
    const sourceTenantIdRaw = q.sourceTenantId;
    const sourceTenantId =
      sourceTenantIdRaw != null && String(sourceTenantIdRaw).trim() !== ''
        ? Number(sourceTenantIdRaw)
        : undefined;

    try {
      const result = await this.pgDumpService.importPgDump({
        tenantId,
        actorUserId,
        fileBuffer: file.buffer,
        replaceTenantData,
        birthDateFallback,
        sourceTenantId:
          sourceTenantId != null && Number.isFinite(sourceTenantId)
            ? sourceTenantId
            : undefined,
      });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(400).json({
        error: (err as Error).message || 'Falha ao importar dump PostgreSQL',
      });
    }
  }

  async getTemplate(_req: Request, res: Response) {
    try {
      const buf = await buildTenantImportTemplateBuffer();

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="template-importacao.xlsx"',
      );
      return res.status(200).send(buf);
    } catch {
      return res.status(500).json({ error: 'Falha ao gerar template' });
    }
  }

  async importPgDumpAsync(req: UploadRequest, res: Response, tenantId: number) {
    const actorUserId = req.user?.id;
    if (!actorUserId) {
      return res.status(401).json({ error: 'Sessão inválida' });
    }

    const file = req.file;
    if (!file?.buffer || file.buffer.length === 0) {
      return res
        .status(400)
        .json({ error: 'Arquivo obrigatório (campo file: .sql ou .sql.gz)' });
    }

    const q = req.query as Record<string, string | undefined>;
    const replaceTenantData =
      q.replaceTenantData === '1' ||
      q.replaceTenantData === 'true' ||
      q.replace === '1';
    const birthDateFallback =
      typeof q.birthDateFallback === 'string' && q.birthDateFallback.trim()
        ? q.birthDateFallback.trim()
        : undefined;
    const sourceTenantIdRaw = q.sourceTenantId;
    const sourceTenantId =
      sourceTenantIdRaw != null && String(sourceTenantIdRaw).trim() !== ''
        ? Number(sourceTenantIdRaw)
        : undefined;

    const uploadDir =
      process.env.IMPORT_UPLOAD_DIR?.trim() || '/var/lib/abrigo-imports';
    await mkdir(uploadDir, { recursive: true });
    const jobId = crypto.randomUUID();
    const ext = (file.originalname || '').toLowerCase().endsWith('.gz')
      ? 'sql.gz'
      : 'sql';
    const filePath = join(uploadDir, `${jobId}.${ext}`);
    await writeFile(filePath, file.buffer);

    await prisma.tenantImportJob.create({
      data: {
        id: jobId,
        tenant_id: tenantId,
        actor_user_id: actorUserId,
        kind: 'pg_dump',
        status: 'queued',
        file_path: filePath,
        options_json: {
          replaceTenantData,
          birthDateFallback,
          sourceTenantId:
            sourceTenantId != null && Number.isFinite(sourceTenantId)
              ? sourceTenantId
              : undefined,
        } satisfies Prisma.InputJsonObject,
      },
    });

    const workflowId = `tenant:${tenantId}:import:${jobId}`;
    const { client } = await getTemporalClient();
    await client.workflow.start('tenantImportJobWorkflow', {
      taskQueue: envTemporalTaskQueue(),
      workflowId,
      args: [jobId],
    });

    return res.status(202).json({ jobId, workflowId, accepted: true });
  }

  async getJob(req: UploadRequest, res: Response, tenantId: number) {
    const actorUserId = req.user?.id;
    if (!actorUserId) {
      return res.status(401).json({ error: 'Sessão inválida' });
    }
    const id = String(req.params?.jobId ?? '').trim();
    if (!id) return res.status(400).json({ error: 'jobId obrigatório' });
    const job = await prisma.tenantImportJob.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!job) return res.status(404).json({ error: 'Job não encontrado' });
    return res.json(job);
  }
}

import type { Request, Response } from 'express';
import type { AuthRequest } from '@middlewares/auth.middleware';
import { PrismaTenantRepository } from '@repositories/tenant.repository';
import { TenantImportService } from '@services/tenant-import.service';
import { TenantPgDumpImportService } from '@services/tenant-pg-dump-import.service';
import { buildTenantImportTemplateBuffer } from '@helpers/tenant-import-template.excel';
import { prisma } from '@repositories/prisma';
import { envTemporalTaskQueue, getTemporalClient } from '@temporal/client';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import crypto from 'node:crypto';

type UploadRequest = Request &
  AuthRequest & { file?: Express.Multer.File } & { params: { slug?: string } };

const tenantRepo = new PrismaTenantRepository();

export class AdminTenantImportController {
  constructor(
    private readonly xlsxService: TenantImportService,
    private readonly pgDumpService: TenantPgDumpImportService,
  ) {}

  private async resolveTenantIdFromSlug(
    req: UploadRequest,
    res: Response,
  ): Promise<number | null> {
    const slug = String(req.params?.slug ?? '').trim();
    if (!slug) {
      res.status(400).json({ error: 'slug obrigatório' });
      return null;
    }
    const id = await tenantRepo.findIdBySlug(slug);
    if (id == null) {
      res.status(404).json({ error: 'Abrigo não encontrado' });
      return null;
    }
    return id;
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

  async importXlsx(req: UploadRequest, res: Response) {
    const tenantId = await this.resolveTenantIdFromSlug(req, res);
    if (tenantId == null) return;

    const file = req.file;
    if (!file?.buffer || file.buffer.length === 0) {
      return res
        .status(400)
        .json({ error: 'Arquivo .xlsx obrigatório (campo file)' });
    }

    const actorUserId = req.user?.id ?? 0;

    try {
      const result = await this.xlsxService.importXlsx({
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

  async importXlsxAsync(req: UploadRequest, res: Response) {
    const tenantId = await this.resolveTenantIdFromSlug(req, res);
    if (tenantId == null) return;

    const file = req.file;
    if (!file?.buffer || file.buffer.length === 0) {
      return res
        .status(400)
        .json({ error: 'Arquivo .xlsx obrigatório (campo file)' });
    }

    const actorUserId = req.user?.id ?? 0;
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

  async importPgDump(req: UploadRequest, res: Response) {
    const tenantId = await this.resolveTenantIdFromSlug(req, res);
    if (tenantId == null) return;

    const file = req.file;
    if (!file?.buffer || file.buffer.length === 0) {
      return res
        .status(400)
        .json({ error: 'Arquivo obrigatório (campo file: .sql ou .sql.gz)' });
    }

    const actorUserId = req.user?.id ?? 0;
    const q = (req.query ?? {}) as Record<string, string | undefined>;
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

  async importPgDumpAsync(req: UploadRequest, res: Response) {
    const tenantId = await this.resolveTenantIdFromSlug(req, res);
    if (tenantId == null) return;

    const file = req.file;
    if (!file?.buffer || file.buffer.length === 0) {
      return res
        .status(400)
        .json({ error: 'Arquivo obrigatório (campo file: .sql ou .sql.gz)' });
    }

    const actorUserId = req.user?.id ?? 0;
    const q = (req.query ?? {}) as Record<string, string | undefined>;
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
        } as any,
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

  async getJob(req: UploadRequest, res: Response) {
    const tenantId = await this.resolveTenantIdFromSlug(req, res);
    if (tenantId == null) return;
    const id = String((req as any).params?.jobId ?? '').trim();
    if (!id) return res.status(400).json({ error: 'jobId obrigatório' });
    const job = await prisma.tenantImportJob.findFirst({
      where: { id, tenant_id: tenantId },
    });
    if (!job) return res.status(404).json({ error: 'Job não encontrado' });
    return res.json(job);
  }
}

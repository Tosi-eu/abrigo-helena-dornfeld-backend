import type { Request, Response } from 'express';
import type { AuthRequest } from '@middlewares/auth.middleware';
import { PrismaTenantRepository } from '@repositories/tenant.repository';
import { TenantImportService } from '@services/tenant-import.service';
import { TenantPgDumpImportService } from '@services/tenant-pg-dump-import.service';
import { buildTenantImportTemplateBuffer } from '@helpers/tenant-import-template.excel';

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

    // Em chamadas via X-API-Key, podemos não ter sessão; ainda assim precisamos
    // setar um current_user_id para RLS/auditoria. Usamos 0 como “sistema”.
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
}

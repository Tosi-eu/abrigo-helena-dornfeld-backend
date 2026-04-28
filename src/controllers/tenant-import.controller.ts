import type { Request, Response } from 'express';
import type { AuthRequest } from '@middlewares/auth.middleware';
import type { TenantRequest } from '@middlewares/tenant.middleware';
import { TenantImportService } from '@services/tenant-import.service';
import { buildTenantImportTemplateBuffer } from '@helpers/tenant-import-template.excel';

type UploadRequest = Request &
  AuthRequest &
  TenantRequest & { file?: Express.Multer.File };

export class TenantImportController {
  constructor(private readonly service: TenantImportService) {}

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
}

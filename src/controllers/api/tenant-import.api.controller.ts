import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { tenantXlsxUpload } from '@config/upload/multer-xlsx.config';
import { TenantImportController } from '@controllers/tenant-import.controller';
import { TenantId } from '@decorators/tenant-id.decorator';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { requireAdmin } from '@middlewares/admin.middleware';

const requireAdminGuard = UseExpressMwGuard(requireAdmin);
const importUploadGuard = UseExpressMwGuard(
  requireAdmin,
  tenantXlsxUpload.single('file'),
);

@ApiTags('Tenant')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('tenant/import')
export class TenantImportApiController {
  constructor(private readonly controller: TenantImportController) {}

  @Get('template')
  @ApiOperation({ summary: '[Admin] Baixar template XLSX de importação' })
  @UseGuards(requireAdminGuard)
  template(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getTemplate(req, res);
  }

  @Post('xlsx')
  @ApiOperation({
    summary: '[Admin] Importar dados via XLSX (multipart campo `file`)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseGuards(importUploadGuard)
  importXlsx(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.importXlsx(req as any, res, tenantId);
  }
}

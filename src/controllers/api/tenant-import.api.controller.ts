import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
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
import { tenantPgDumpUpload } from '@config/upload/multer-pg-dump.config';
import { TenantImportController } from '@controllers/tenant-import.controller';
import { TenantId } from '@decorators/tenant-id.decorator';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { requireAdmin } from '@middlewares/admin.middleware';

const requireAdminGuard = UseExpressMwGuard(requireAdmin);
const importUploadGuard = UseExpressMwGuard(
  requireAdmin,
  tenantXlsxUpload.single('file'),
);

const pgDumpUploadGuard = UseExpressMwGuard(
  requireAdmin,
  tenantPgDumpUpload.single('file'),
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

  @Post('xlsx/async')
  @ApiOperation({
    summary: '[Admin] Importar dados via XLSX (assíncrono via Temporal)',
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
  importXlsxAsync(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.importXlsxAsync(req as any, res, tenantId);
  }

  @Post('pg-dump')
  @ApiOperation({
    summary:
      '[Admin] Importar dump PostgreSQL do abrigo (.sql / .sql.gz, COPY stdin)',
    description:
      'Anexa dados operacionais ao abrigo atual (não altera logo nem configurações do tenant). Query opcional: birthDateFallback (sobrepõe IMPORT_BIRTH_DATE_FALLBACK / system_config), replaceTenantData=1 (apaga dados do abrigo antes; raramente necessário), sourceTenantId (dump multi-tenant).',
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
  @UseGuards(pgDumpUploadGuard)
  importPgDump(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.importPgDump(req as any, res, tenantId);
  }

  @Post('pg-dump/async')
  @ApiOperation({
    summary:
      '[Admin] Importar dump PostgreSQL (assíncrono via Temporal, multipart file)',
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
  @UseGuards(pgDumpUploadGuard)
  importPgDumpAsync(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.importPgDumpAsync(req as any, res, tenantId);
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: '[Admin] Consultar estado de importação (job)' })
  @UseGuards(requireAdminGuard)
  getJob(
    @TenantId() tenantId: number,
    @Param('jobId') jobId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    (req as any).params = { ...(req as any).params, jobId };
    void this.controller.getJob(req as any, res, tenantId);
  }
}

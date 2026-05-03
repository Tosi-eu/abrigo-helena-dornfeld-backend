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
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { tenantXlsxUpload } from '@config/upload/multer-xlsx.config';
import { tenantPgDumpUpload } from '@config/upload/multer-pg-dump.config';
import { AdminTenantImportController } from '@controllers/admin-tenant-import.controller';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { optionalAuthMiddleware } from '@middlewares/auth.middleware';
import { bindSuperAdminRlsTransaction } from '@middlewares/request-rls-transaction.middleware';
import { requireSuperAdminOrApiKey } from '@middlewares/super-admin.middleware';

const adminImportGuard = UseExpressMwGuard(
  bindSuperAdminRlsTransaction,
  optionalAuthMiddleware,
  requireSuperAdminOrApiKey,
);

const adminImportXlsxUploadGuard = UseExpressMwGuard(
  bindSuperAdminRlsTransaction,
  optionalAuthMiddleware,
  requireSuperAdminOrApiKey,
  tenantXlsxUpload.single('file'),
);

const adminImportPgDumpUploadGuard = UseExpressMwGuard(
  bindSuperAdminRlsTransaction,
  optionalAuthMiddleware,
  requireSuperAdminOrApiKey,
  tenantPgDumpUpload.single('file'),
);

@ApiTags('Administração')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('admin/tenants/by-slug/:slug/import')
export class AdminTenantImportApiController {
  constructor(private readonly controller: AdminTenantImportController) {}

  @Get('template')
  @ApiOperation({
    summary: '[Super-admin] Baixar template XLSX de importação (por slug)',
  })
  @ApiParam({ name: 'slug' })
  @UseGuards(adminImportGuard)
  template(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getTemplate(req, res);
  }

  @Post('xlsx')
  @ApiOperation({
    summary: '[Super-admin] Importar dados via XLSX (por slug, multipart file)',
  })
  @ApiParam({ name: 'slug' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseGuards(adminImportXlsxUploadGuard)
  importXlsx(@Req() req: Request, @Res() res: Response): void {
    void this.controller.importXlsx(req as any, res);
  }

  @Post('xlsx/async')
  @ApiOperation({
    summary:
      '[Super-admin] Importar dados via XLSX (assíncrono via Temporal, por slug)',
  })
  @ApiParam({ name: 'slug' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseGuards(adminImportXlsxUploadGuard)
  importXlsxAsync(@Req() req: Request, @Res() res: Response): void {
    void this.controller.importXlsxAsync(req as any, res);
  }

  @Post('pg-dump')
  @ApiOperation({
    summary:
      '[Super-admin] Importar dump PostgreSQL do abrigo (.sql/.sql.gz, por slug)',
    description:
      'Anexa dados operacionais ao abrigo escolhido pelo slug. Query opcional: birthDateFallback, replaceTenantData=1, sourceTenantId.',
  })
  @ApiParam({ name: 'slug' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseGuards(adminImportPgDumpUploadGuard)
  importPgDump(@Req() req: Request, @Res() res: Response): void {
    void this.controller.importPgDump(req as any, res);
  }

  @Post('pg-dump/async')
  @ApiOperation({
    summary:
      '[Super-admin] Importar dump PostgreSQL (assíncrono via Temporal, por slug)',
  })
  @ApiParam({ name: 'slug' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseGuards(adminImportPgDumpUploadGuard)
  importPgDumpAsync(@Req() req: Request, @Res() res: Response): void {
    void this.controller.importPgDumpAsync(req as any, res);
  }

  @Get('jobs/:jobId')
  @ApiOperation({
    summary: '[Super-admin] Consultar estado de importação (job, por slug)',
  })
  @ApiParam({ name: 'slug' })
  @UseGuards(adminImportGuard)
  getJob(
    @Param('jobId') jobId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    (req as any).params = { ...(req as any).params, jobId };
    void this.controller.getJob(req as any, res);
  }
}

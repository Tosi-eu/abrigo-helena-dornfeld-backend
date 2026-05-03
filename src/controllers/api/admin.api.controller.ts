import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { adminBackupUpload } from '@config/upload/multer-r2.config';
import { AdminController } from '@controllers/admin.controller';
import { TenantId } from '@decorators/tenant-id.decorator';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { requireSuperAdmin } from '@middlewares/super-admin.middleware';
import {
  AdminCreateUserBodyDto,
  AdminMergeMedicinesBodyDto,
  AdminNormalizeUnitsBodyDto,
  AdminPatchNotificationBodyDto,
  AdminUpdateUserBodyDto,
} from '@domain/dto/entities.api.dto';
import { UseValidatedBody } from '@validation/use-validated-body.guard';

const superAdminUpload = UseExpressMwGuard(
  requireSuperAdmin,
  adminBackupUpload.single('file'),
);
const adminCreateUserBody = UseValidatedBody(AdminCreateUserBodyDto);
const adminUpdateUserBody = UseValidatedBody(AdminUpdateUserBodyDto);
const adminMergeMeds = UseValidatedBody(AdminMergeMedicinesBodyDto);
const adminNormUnits = UseValidatedBody(AdminNormalizeUnitsBodyDto);
const adminPatchNotif = UseValidatedBody(AdminPatchNotificationBodyDto);

@ApiTags('Administração')
@ApiBearerAuth()
@ApiSecurity('bearer')
@Controller('admin')
export class AdminApiController {
  constructor(private readonly controller: AdminController) {}

  @Get('users')
  @ApiOperation({ summary: '[Admin] Listar utilizadores do abrigo atual' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  users(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.listUsers(req, res, tenantId);
  }

  @Post('users')
  @ApiOperation({ summary: '[Admin] Criar utilizador (no abrigo atual)' })
  @ApiBody({ type: AdminCreateUserBodyDto })
  @UseGuards(adminCreateUserBody)
  createUser(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.createUser(req, res, tenantId);
  }

  @Put('users/:id')
  @ApiOperation({ summary: '[Admin] Atualizar utilizador (no abrigo atual)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: AdminUpdateUserBodyDto })
  @UseGuards(adminUpdateUserBody)
  updateUser(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.updateUser(req, res, tenantId);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: '[Admin] Remover utilizador (no abrigo atual)' })
  @ApiParam({ name: 'id', type: Number })
  deleteUser(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.deleteUser(req, res, tenantId);
  }

  @Get('login-log')
  @ApiOperation({ summary: 'Log de tentativas de login (filtros via query)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'login', required: false })
  @ApiQuery({ name: 'success', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  loginLog(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getLoginLog(req, res);
  }

  @Get('insights')
  @ApiOperation({ summary: 'Indicadores / insights' })
  @ApiQuery({ name: 'days', required: false })
  insights(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getInsights(req, res);
  }

  @Get('stock-history')
  @ApiOperation({ summary: 'Histórico de stock' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'operationType', required: false })
  stockHistory(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getStockHistory(req, res);
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportação de dados (CSV/relatório)' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'periodo', required: false })
  @ApiQuery({ name: 'data', required: false })
  @ApiQuery({ name: 'data_inicial', required: false })
  @ApiQuery({ name: 'data_final', required: false })
  @ApiQuery({ name: 'mes', required: false })
  @ApiQuery({ name: 'casela', required: false })
  export(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getExport(req, res);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Métricas agregadas' })
  @ApiQuery({ name: 'type', required: false })
  metrics(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getMetrics(req, res);
  }

  @Get('metrics/active-users')
  @ApiOperation({ summary: 'Utilizadores ativos (mês corrente)' })
  activeUsers(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getActiveUsersThisMonth(req, res);
  }

  @Get('metrics/movements')
  @ApiOperation({ summary: 'Movimentações no mês' })
  movements(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getMovementsThisMonth(req, res);
  }

  @Get('health')
  @ApiOperation({ summary: 'Estado de saúde detalhado (admin)' })
  health(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getHealth(req, res);
  }

  @Get('config')
  @ApiOperation({ summary: 'Configuração global do sistema' })
  config(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getConfig(req, res);
  }

  @Put('config')
  @ApiOperation({ summary: 'Atualizar configuração global' })
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Legado: mapa chave→string (apenas display_* )',
        },
        {
          type: 'object',
          properties: {
            display: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
            system: { type: 'object' },
          },
        },
      ],
    },
  })
  putConfig(@Req() req: Request, @Res() res: Response): void {
    void this.controller.updateConfig(req, res);
  }

  @Get('data-quality/summary')
  @ApiOperation({ summary: 'Resumo de qualidade de dados' })
  dataQualitySummary(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getDataQualitySummary(req, res);
  }

  @Get('data-quality/inconsistencies')
  @ApiOperation({ summary: 'Listar inconsistências' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'lote', required: false })
  @ApiQuery({ name: 'itemType', required: false })
  @ApiQuery({ name: 'itemId', required: false })
  inconsistencies(@Req() req: Request, @Res() res: Response): void {
    void this.controller.listInconsistencies(req, res);
  }

  @Get('data-quality/medicine-duplicates')
  @ApiOperation({ summary: 'Medicamentos duplicados' })
  medicineDuplicates(@Req() req: Request, @Res() res: Response): void {
    void this.controller.listMedicineDuplicates(req, res);
  }

  @Post('data-quality/merge-medicines')
  @ApiOperation({ summary: 'Fundir medicamentos duplicados' })
  @ApiBody({ type: AdminMergeMedicinesBodyDto })
  @UseGuards(adminMergeMeds)
  mergeMedicines(@Req() req: Request, @Res() res: Response): void {
    void this.controller.mergeMedicines(req, res);
  }

  @Post('data-quality/normalize-medicine-units')
  @ApiOperation({ summary: 'Normalizar unidades de medicamentos' })
  @ApiBody({ type: AdminNormalizeUnitsBodyDto })
  @UseGuards(adminNormUnits)
  normalizeUnits(@Req() req: Request, @Res() res: Response): void {
    void this.controller.normalizeMedicineUnits(req, res);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Eventos de notificação (sistema)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  notifications(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getNotifications(req, res);
  }

  @Patch('notifications/:id')
  @ApiOperation({ summary: 'Atualizar estado de notificação' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: AdminPatchNotificationBodyDto })
  @UseGuards(adminPatchNotif)
  patchNotification(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.patchNotification(req, res, tenantId);
  }

  @Post('restore-backup')
  @ApiOperation({
    summary: '[Super-admin] Restaurar backup',
    description: 'Envio multipart com campo `file` (até 200MB).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Ficheiro de backup',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Restauro iniciado ou concluído' })
  @UseGuards(superAdminUpload)
  restoreBackup(@Req() req: Request, @Res() res: Response): void {
    void this.controller.restoreBackup(req, res);
  }
}

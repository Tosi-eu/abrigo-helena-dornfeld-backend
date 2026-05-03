import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SetorController } from '@controllers/setor.controller';
import { TenantId } from '@decorators/tenant-id.decorator';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { requireModule } from '@middlewares/module.middleware';
import { requireAdmin } from '@middlewares/admin.middleware';
import { SetorCreateBodyDto } from '@domain/dto/entities.api.dto';
import { UseValidatedBody } from '@validation/use-validated-body.guard';

const stockModule = UseExpressMwGuard(requireModule('stock'));
const requireAdminGuard = UseExpressMwGuard(requireAdmin);
const setorCreateBody = UseValidatedBody(SetorCreateBodyDto);

@ApiTags('Setores')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('tenant/setores')
export class SetorApiController {
  constructor(private readonly controller: SetorController) {}

  @Get()
  @ApiOperation({ summary: 'Listar setores do abrigo (catálogo)' })
  @UseGuards(stockModule)
  list(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.list(req, res, tenantId);
  }

  @Post()
  @ApiOperation({ summary: '[Admin] Criar setor personalizado' })
  @ApiBody({ type: SetorCreateBodyDto })
  @UseGuards(setorCreateBody, stockModule, requireAdminGuard)
  create(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.create(req, res, tenantId);
  }
}

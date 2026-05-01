import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { DashboardController } from '@controllers/dashboard.controller';
import { TenantId } from '@decorators/tenant-id.decorator';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { requireModule } from '@middlewares/module.middleware';

const dashModule = UseExpressMwGuard(requireModule('dashboard'));

@ApiTags('Dashboard')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('dashboard')
export class DashboardApiController {
  constructor(private readonly controller: DashboardController) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumo do painel (KPIs)' })
  @ApiResponse({ status: 200, description: 'Agregados do dashboard' })
  @UseGuards(dashModule)
  summary(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getSummary(req, res, tenantId);
  }

  @Get('expiring-items')
  @ApiOperation({
    summary: 'Itens a expirar (medicamentos / stock)',
    description: 'Query opcional conforme implementação no controller legacy.',
  })
  @ApiResponse({ status: 200, description: 'Lista de itens' })
  @UseGuards(dashModule)
  expiringItems(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getExpiringItems(req, res, tenantId);
  }
}

import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MovementController } from '@controllers/movimentacao.controller';
import { TenantId } from '@decorators/tenant-id.decorator';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { requireModule } from '@middlewares/module.middleware';
import { validatePagination } from '@middlewares/validation.middleware';
import { MovementCreateBodyDto } from '@domain/dto/entities.api.dto';
import { UseValidatedBody } from '@validation/use-validated-body.guard';

const movModule = UseExpressMwGuard(requireModule('movements'));
const movPaginate = UseExpressMwGuard(
  validatePagination,
  requireModule('movements'),
);
const movCreateBody = UseValidatedBody(MovementCreateBodyDto);

@ApiTags('Movimentações')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('movimentacoes')
export class MovimentacaoApiController {
  constructor(private readonly controller: MovementController) {}

  @Get('produtos-parados')
  @ApiOperation({ summary: 'Medicamentos sem movimento' })
  @UseGuards(movModule)
  produtosParados(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.nonMovementMedications(req, res, tenantId);
  }

  @Get('medicamentos')
  @ApiOperation({ summary: 'Listar movimentos de medicamentos (paginado)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(movPaginate)
  medicamentos(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getMedicines(req, res, tenantId);
  }

  @Get('insumos')
  @ApiOperation({ summary: 'Listar movimentos de insumos (paginado)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(movPaginate)
  insumos(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getInputs(req, res, tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Registar movimentação manual' })
  @ApiBody({ type: MovementCreateBodyDto })
  @UseGuards(movCreateBody, movModule)
  create(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.create(req, res, tenantId);
  }

  @Get('medicamentos/ranking')
  @ApiOperation({ summary: 'Ranking de medicamentos' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(movPaginate)
  medicamentosRanking(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getMedicineRanking(req, res, tenantId);
  }

  @Get('transferencias/farmacia-enfermaria')
  @ApiOperation({ summary: 'Transferências farmácia → enfermaria' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(movPaginate)
  transferencias(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getPharmacyToNursingTransfers(req, res, tenantId);
  }

  @Get('consumo')
  @ApiOperation({ summary: 'Consumo agregado' })
  @UseGuards(movModule)
  consumo(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getConsumption(req, res, tenantId);
  }

  @Get('consumo-por-item')
  @ApiOperation({ summary: 'Consumo por item' })
  @UseGuards(movModule)
  consumoPorItem(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getConsumptionByItem(req, res, tenantId);
  }
}

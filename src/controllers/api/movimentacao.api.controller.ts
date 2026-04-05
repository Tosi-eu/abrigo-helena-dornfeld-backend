import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
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
import { UseExpressMwGuard } from '@guards/express-middleware.guard';
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
  produtosParados(@Req() req: Request, @Res() res: Response): void {
    this.controller.nonMovementMedications(req, res);
  }

  @Get('medicamentos')
  @ApiOperation({ summary: 'Listar movimentos de medicamentos (paginado)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(movPaginate)
  medicamentos(@Req() req: Request, @Res() res: Response): void {
    this.controller.getMedicines(req, res);
  }

  @Get('insumos')
  @ApiOperation({ summary: 'Listar movimentos de insumos (paginado)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(movPaginate)
  insumos(@Req() req: Request, @Res() res: Response): void {
    this.controller.getInputs(req, res);
  }

  @Post()
  @ApiOperation({ summary: 'Registar movimentação manual' })
  @ApiBody({ type: MovementCreateBodyDto })
  @UseGuards(movCreateBody, movModule)
  create(@Req() req: Request, @Res() res: Response): void {
    this.controller.create(req, res);
  }

  @Get('medicamentos/ranking')
  @ApiOperation({ summary: 'Ranking de medicamentos' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(movPaginate)
  medicamentosRanking(@Req() req: Request, @Res() res: Response): void {
    this.controller.getMedicineRanking(req, res);
  }

  @Get('transferencias/farmacia-enfermaria')
  @ApiOperation({ summary: 'Transferências farmácia → enfermaria' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(movPaginate)
  transferencias(@Req() req: Request, @Res() res: Response): void {
    this.controller.getPharmacyToNursingTransfers(req, res);
  }

  @Get('consumo')
  @ApiOperation({ summary: 'Consumo agregado' })
  @UseGuards(movModule)
  consumo(@Req() req: Request, @Res() res: Response): void {
    this.controller.getConsumption(req, res);
  }

  @Get('consumo-por-item')
  @ApiOperation({ summary: 'Consumo por item' })
  @UseGuards(movModule)
  consumoPorItem(@Req() req: Request, @Res() res: Response): void {
    this.controller.getConsumptionByItem(req, res);
  }
}

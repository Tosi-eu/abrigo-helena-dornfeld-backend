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
  ApiBody,
  ApiCookieAuth,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { StockController } from '@controllers/estoque.controller';
import { UseExpressMwGuard } from '@guards/express-middleware.guard';
import { requireModule } from '@middlewares/module.middleware';
import {
  validateEstoqueIdParam,
  validatePagination,
} from '@middlewares/validation.middleware';
import {
  InputStockInBodyDto,
  MedicineStockInBodyDto,
  StockOutBodyDto,
  TransferInputSectorBodyDto,
  TransferMedicineSectorBodyDto,
  UpdateStockItemBodyDto,
} from '@domain/dto/entities.api.dto';
import { stockEntradaBodyMiddleware } from '@validation/stock-entrada.middleware';
import {
  UseExpressMiddleware,
  UseValidatedBody,
} from '@validation/use-validated-body.guard';

const stockModule = UseExpressMwGuard(requireModule('stock'));
const stockModuleEstoque = UseExpressMwGuard(
  validateEstoqueIdParam,
  requireModule('stock'),
);
const stockEntradaMw = UseExpressMiddleware(stockEntradaBodyMiddleware);
const stockOutBody = UseValidatedBody(StockOutBodyDto);
const transferMedBody = UseValidatedBody(TransferMedicineSectorBodyDto);
const transferInsumoBody = UseValidatedBody(TransferInputSectorBodyDto);
const updateStockBody = UseValidatedBody(UpdateStockItemBodyDto);

@ApiTags('Estoque')
@ApiExtraModels(MedicineStockInBodyDto, InputStockInBodyDto)
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('estoque')
export class EstoqueApiController {
  constructor(private readonly controller: StockController) {}

  @Post('entrada')
  @ApiOperation({
    summary: 'Entrada de stock (medicamento ou insumo)',
    description:
      'Envie **medicamento_id** (stock de medicamento) **ou** **insumo_id** (stock de insumo); não ambos.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(MedicineStockInBodyDto) },
        { $ref: getSchemaPath(InputStockInBodyDto) },
      ],
    },
  })
  @UseGuards(stockEntradaMw, stockModule)
  entrada(@Req() req: Request, @Res() res: Response): void {
    this.controller.stockIn(req, res);
  }

  @Post('saida')
  @ApiOperation({ summary: 'Saída de stock' })
  @ApiBody({ type: StockOutBodyDto })
  @UseGuards(stockOutBody, stockModule)
  saida(@Req() req: Request, @Res() res: Response): void {
    this.controller.stockOut(req, res);
  }

  @Get()
  @ApiOperation({ summary: 'Listar linhas de stock' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(UseExpressMwGuard(validatePagination, requireModule('stock')))
  list(@Req() req: Request, @Res() res: Response): void {
    this.controller.list(req, res);
  }

  @Get('filter-options')
  @ApiOperation({ summary: 'Opções para filtros da listagem' })
  @UseGuards(stockModule)
  filterOptions(@Req() req: Request, @Res() res: Response): void {
    this.controller.getFilterOptions(req, res);
  }

  @Get('proporcao')
  @ApiOperation({ summary: 'Proporção / totais por categoria' })
  @UseGuards(stockModule)
  proporcao(@Req() req: Request, @Res() res: Response): void {
    this.controller.proportion(req, res);
  }

  @Get('medicamento/dias-para-repor')
  @ApiOperation({ summary: 'Dias para repor (medicamentos por enfermagem)' })
  @UseGuards(stockModule)
  diasParaRepor(@Req() req: Request, @Res() res: Response): void {
    this.controller.getDaysForReplacementForNursing(req, res);
  }

  @Patch('medicamento/:estoque_id/remover-individual')
  @ApiOperation({ summary: 'Remover unidade individual (medicamento)' })
  @ApiParam({ name: 'estoque_id', type: Number })
  @UseGuards(stockModuleEstoque)
  medRemoverIndividual(@Req() req: Request, @Res() res: Response): void {
    this.controller.removeIndividualMedicine(req, res);
  }

  @Patch('medicamento/:estoque_id/suspender')
  @ApiOperation({ summary: 'Suspender medicamento no stock' })
  @ApiParam({ name: 'estoque_id', type: Number })
  @UseGuards(stockModuleEstoque)
  medSuspender(@Req() req: Request, @Res() res: Response): void {
    this.controller.suspendIndividualMedicine(req, res);
  }

  @Patch('medicamento/:estoque_id/retomar')
  @ApiOperation({ summary: 'Retomar medicamento suspenso' })
  @ApiParam({ name: 'estoque_id', type: Number })
  @UseGuards(stockModuleEstoque)
  medRetomar(@Req() req: Request, @Res() res: Response): void {
    this.controller.resumeIndividualMedicine(req, res);
  }

  @Patch('medicamento/:estoque_id/transferir-setor')
  @ApiOperation({ summary: 'Transferir medicamento entre setores' })
  @ApiParam({ name: 'estoque_id', type: Number })
  @ApiBody({ type: TransferMedicineSectorBodyDto })
  @UseGuards(transferMedBody, stockModuleEstoque)
  medTransferirSetor(@Req() req: Request, @Res() res: Response): void {
    this.controller.transferMedicineSector(req, res);
  }

  @Patch('insumo/:estoque_id/remover-individual')
  @ApiOperation({ summary: 'Remover unidade individual (insumo)' })
  @ApiParam({ name: 'estoque_id', type: Number })
  @UseGuards(stockModuleEstoque)
  insumoRemoverIndividual(@Req() req: Request, @Res() res: Response): void {
    this.controller.removeIndividualInput(req, res);
  }

  @Patch('insumo/:estoque_id/suspender')
  @ApiOperation({ summary: 'Suspender insumo' })
  @ApiParam({ name: 'estoque_id', type: Number })
  @UseGuards(stockModuleEstoque)
  insumoSuspender(@Req() req: Request, @Res() res: Response): void {
    this.controller.suspendIndividualInput(req, res);
  }

  @Patch('insumo/:estoque_id/retomar')
  @ApiOperation({ summary: 'Retomar insumo suspenso' })
  @ApiParam({ name: 'estoque_id', type: Number })
  @UseGuards(stockModuleEstoque)
  insumoRetomar(@Req() req: Request, @Res() res: Response): void {
    this.controller.resumeIndividualInput(req, res);
  }

  @Patch('insumo/:estoque_id/transferir-setor')
  @ApiOperation({ summary: 'Transferir insumo entre setores' })
  @ApiParam({ name: 'estoque_id', type: Number })
  @ApiBody({ type: TransferInputSectorBodyDto })
  @UseGuards(transferInsumoBody, stockModuleEstoque)
  insumoTransferirSetor(@Req() req: Request, @Res() res: Response): void {
    this.controller.transferInputSector(req, res);
  }

  @Put(':estoque_id')
  @ApiOperation({ summary: 'Atualizar linha de stock' })
  @ApiParam({ name: 'estoque_id', type: Number })
  @ApiBody({ type: UpdateStockItemBodyDto })
  @UseGuards(updateStockBody, stockModuleEstoque)
  update(@Req() req: Request, @Res() res: Response): void {
    this.controller.updateStockItem(req, res);
  }

  @Delete(':tipo/:estoque_id')
  @ApiOperation({ summary: 'Eliminar linha de stock' })
  @ApiParam({ name: 'tipo', description: 'medicamento | insumo (conforme API)' })
  @ApiParam({ name: 'estoque_id', type: Number })
  @UseGuards(stockModuleEstoque)
  delete(@Req() req: Request, @Res() res: Response): void {
    this.controller.deleteStockItem(req, res);
  }
}

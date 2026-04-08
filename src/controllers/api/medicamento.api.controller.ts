import {
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MedicineController } from '@controllers/medicamento.controller';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { requireModule } from '@middlewares/module.middleware';
import {
  validateIdParam,
  validatePagination,
} from '@middlewares/validation.middleware';
import { MedicineBodyDto } from '@domain/dto/entities.api.dto';
import { UseValidatedBody } from '@validation/use-validated-body.guard';

const medModule = UseExpressMwGuard(requireModule('medicines'));
const medPaginate = UseExpressMwGuard(
  validatePagination,
  requireModule('medicines'),
);
const medId = UseExpressMwGuard(validateIdParam, requireModule('medicines'));
const medBody = UseValidatedBody(MedicineBodyDto);

@ApiTags('Medicamentos')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('medicamentos')
export class MedicamentoApiController {
  constructor(private readonly controller: MedicineController) {}

  @Post()
  @ApiOperation({ summary: 'Criar medicamento' })
  @ApiBody({ type: MedicineBodyDto })
  @UseGuards(medBody, medModule)
  create(@Req() req: Request, @Res() res: Response): void {
    void this.controller.create(req, res);
  }

  @Get()
  @ApiOperation({ summary: 'Listar medicamentos (paginado)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(medPaginate)
  getAll(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getAll(req, res);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar medicamento' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: MedicineBodyDto })
  @UseGuards(medBody, medId)
  update(@Req() req: Request, @Res() res: Response): void {
    void this.controller.update(req, res);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover medicamento' })
  @ApiParam({ name: 'id', type: Number })
  @UseGuards(medId)
  delete(@Req() req: Request, @Res() res: Response): void {
    void this.controller.delete(req, res);
  }
}

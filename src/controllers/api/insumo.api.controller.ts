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
import { InsumoController } from '@controllers/insumo.controller';
import { TenantId } from '@decorators/tenant-id.decorator';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import {
  validateIdParam,
  validatePagination,
} from '@middlewares/validation.middleware';
import { InputBodyDto } from '@domain/dto/entities.api.dto';
import { UseValidatedBody } from '@validation/use-validated-body.guard';

const insPaginate = UseExpressMwGuard(validatePagination);
const insId = UseExpressMwGuard(validateIdParam);
const insBody = UseValidatedBody(InputBodyDto);

@ApiTags('Insumos')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('insumos')
export class InsumoApiController {
  constructor(private readonly controller: InsumoController) {}

  @Post()
  @ApiOperation({ summary: 'Criar insumo' })
  @ApiBody({ type: InputBodyDto })
  @UseGuards(insBody)
  create(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.create(req, res, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar insumos (paginado)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(insPaginate)
  list(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.list(req, res, tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar insumo' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: InputBodyDto })
  @UseGuards(insBody, insId)
  update(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.update(req, res, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover insumo' })
  @ApiParam({ name: 'id', type: Number })
  @UseGuards(insId)
  delete(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.delete(req, res, tenantId);
  }
}

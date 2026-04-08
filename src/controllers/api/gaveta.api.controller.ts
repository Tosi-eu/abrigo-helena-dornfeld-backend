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
import { DrawerController } from '@controllers/gaveta.controller';
import { TenantId } from '@decorators/tenant-id.decorator';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { requireModule } from '@middlewares/module.middleware';
import {
  validateNumeroParam,
  validatePagination,
} from '@middlewares/validation.middleware';
import {
  DrawerCreateBodyDto,
  DrawerUpdateBodyDto,
} from '@domain/dto/entities.api.dto';
import { UseValidatedBody } from '@validation/use-validated-body.guard';

const drModule = UseExpressMwGuard(requireModule('drawers'));
const drPaginate = UseExpressMwGuard(
  validatePagination,
  requireModule('drawers'),
);
const drNumero = UseExpressMwGuard(
  validateNumeroParam,
  requireModule('drawers'),
);
const drCreateBody = UseValidatedBody(DrawerCreateBodyDto);
const drUpdateBody = UseValidatedBody(DrawerUpdateBodyDto);

@ApiTags('Gavetas')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('gavetas')
export class GavetaApiController {
  constructor(private readonly controller: DrawerController) {}

  @Post()
  @ApiOperation({ summary: 'Criar gaveta' })
  @ApiBody({ type: DrawerCreateBodyDto })
  @UseGuards(drCreateBody, drModule)
  create(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.create(req, res, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar gavetas (paginado)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(drPaginate)
  getAll(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getAll(req, res, tenantId);
  }

  @Get('count')
  @ApiOperation({ summary: 'Contagem de gavetas' })
  @UseGuards(drModule)
  count(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getCount(req, res, tenantId);
  }

  @Get(':numero')
  @ApiOperation({ summary: 'Gaveta por número' })
  @ApiParam({ name: 'numero', type: Number })
  @UseGuards(drNumero)
  getById(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getById(req, res, tenantId);
  }

  @Put(':numero')
  @ApiOperation({ summary: 'Atualizar gaveta' })
  @ApiParam({ name: 'numero', type: Number })
  @ApiBody({ type: DrawerUpdateBodyDto })
  @UseGuards(drUpdateBody, drNumero)
  update(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.update(req, res, tenantId);
  }

  @Delete(':numero')
  @ApiOperation({ summary: 'Remover gaveta' })
  @ApiParam({ name: 'numero', type: Number })
  @UseGuards(drNumero)
  delete(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.delete(req, res, tenantId);
  }
}

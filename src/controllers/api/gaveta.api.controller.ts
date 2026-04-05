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
import { UseExpressMwGuard } from '@guards/express-middleware.guard';
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
  create(@Req() req: Request, @Res() res: Response): void {
    this.controller.create(req, res);
  }

  @Get()
  @ApiOperation({ summary: 'Listar gavetas (paginado)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(drPaginate)
  getAll(@Req() req: Request, @Res() res: Response): void {
    this.controller.getAll(req, res);
  }

  @Get('count')
  @ApiOperation({ summary: 'Contagem de gavetas' })
  @UseGuards(drModule)
  count(@Req() req: Request, @Res() res: Response): void {
    this.controller.getCount(req, res);
  }

  @Get(':numero')
  @ApiOperation({ summary: 'Gaveta por número' })
  @ApiParam({ name: 'numero', type: Number })
  @UseGuards(drNumero)
  getById(@Req() req: Request, @Res() res: Response): void {
    this.controller.getById(req, res);
  }

  @Put(':numero')
  @ApiOperation({ summary: 'Atualizar gaveta' })
  @ApiParam({ name: 'numero', type: Number })
  @ApiBody({ type: DrawerUpdateBodyDto })
  @UseGuards(drUpdateBody, drNumero)
  update(@Req() req: Request, @Res() res: Response): void {
    this.controller.update(req, res);
  }

  @Delete(':numero')
  @ApiOperation({ summary: 'Remover gaveta' })
  @ApiParam({ name: 'numero', type: Number })
  @UseGuards(drNumero)
  delete(@Req() req: Request, @Res() res: Response): void {
    this.controller.delete(req, res);
  }
}

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
import { CabinetController } from '@controllers/armario.controller';
import { TenantId } from '@decorators/tenant-id.decorator';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { requireModule } from '@middlewares/module.middleware';
import {
  validateNumeroParam,
  validatePagination,
} from '@middlewares/validation.middleware';
import {
  CabinetCreateBodyDto,
  CabinetUpdateBodyDto,
} from '@domain/dto/entities.api.dto';
import { UseValidatedBody } from '@validation/use-validated-body.guard';

const cabModule = UseExpressMwGuard(requireModule('cabinets'));
const cabPaginate = UseExpressMwGuard(
  validatePagination,
  requireModule('cabinets'),
);
const cabNumero = UseExpressMwGuard(
  validateNumeroParam,
  requireModule('cabinets'),
);
const cabCreateBody = UseValidatedBody(CabinetCreateBodyDto);
const cabUpdateBody = UseValidatedBody(CabinetUpdateBodyDto);

@ApiTags('Armários')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('armarios')
export class ArmarioApiController {
  constructor(private readonly controller: CabinetController) {}

  @Post()
  @ApiOperation({ summary: 'Criar armário' })
  @ApiBody({ type: CabinetCreateBodyDto })
  @UseGuards(cabCreateBody, cabModule)
  create(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.create(req, res, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar armários (paginado)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(cabPaginate)
  getAll(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getAll(req, res, tenantId);
  }

  @Get('count')
  @ApiOperation({ summary: 'Contagem de armários' })
  @UseGuards(cabModule)
  count(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getCount(req, res, tenantId);
  }

  @Put(':numero')
  @ApiOperation({ summary: 'Atualizar armário' })
  @ApiParam({ name: 'numero', type: Number })
  @ApiBody({ type: CabinetUpdateBodyDto })
  @UseGuards(cabUpdateBody, cabNumero)
  update(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.update(req, res, tenantId);
  }

  @Delete(':numero')
  @ApiOperation({ summary: 'Remover armário' })
  @ApiParam({ name: 'numero', type: Number })
  @UseGuards(cabNumero)
  delete(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.delete(req, res, tenantId);
  }
}

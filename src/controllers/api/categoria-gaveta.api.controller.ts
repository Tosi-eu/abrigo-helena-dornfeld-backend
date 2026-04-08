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
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { DrawerCategoryController } from '@controllers/categoria-gaveta.controller';
import { TenantId } from '@decorators/tenant-id.decorator';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { requireModule } from '@middlewares/module.middleware';
import { CategoryNomeBodyDto } from '@domain/dto/entities.api.dto';
import { UseValidatedBody } from '@validation/use-validated-body.guard';

const drCatModule = UseExpressMwGuard(requireModule('drawers'));
const catNomeBody = UseValidatedBody(CategoryNomeBodyDto);

@ApiTags('Categorias de gaveta')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('categoria-gaveta')
export class CategoriaGavetaApiController {
  constructor(private readonly controller: DrawerCategoryController) {}

  @Post()
  @ApiOperation({ summary: 'Criar categoria de gaveta' })
  @ApiBody({ type: CategoryNomeBodyDto })
  @UseGuards(drCatModule)
  create(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.create(req, res, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar categorias' })
  @UseGuards(drCatModule)
  getAll(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getAll(req, res, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Categoria por id' })
  @ApiParam({ name: 'id', type: Number })
  @UseGuards(drCatModule)
  getById(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getById(req, res, tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar categoria' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: CategoryNomeBodyDto })
  @UseGuards(catNomeBody, drCatModule)
  update(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.update(req, res, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover categoria' })
  @ApiParam({ name: 'id', type: Number })
  @UseGuards(drCatModule)
  delete(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.delete(req, res, tenantId);
  }
}

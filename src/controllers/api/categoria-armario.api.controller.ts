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
import { CabinetCategoryController } from '@controllers/categoria-armario.controller';
import { UseExpressMwGuard } from '@guards/express-middleware.guard';
import { requireModule } from '@middlewares/module.middleware';
import { CategoryNomeBodyDto } from '@domain/dto/entities.api.dto';
import { UseValidatedBody } from '@validation/use-validated-body.guard';

const cabCatModule = UseExpressMwGuard(requireModule('cabinets'));
const catNomeBody = UseValidatedBody(CategoryNomeBodyDto);

@ApiTags('Categorias de armário')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('categoria-armario')
export class CategoriaArmarioApiController {
  constructor(private readonly controller: CabinetCategoryController) {}

  @Post()
  @ApiOperation({ summary: 'Criar categoria de armário' })
  @ApiBody({ type: CategoryNomeBodyDto })
  @UseGuards(catNomeBody, cabCatModule)
  create(@Req() req: Request, @Res() res: Response): void {
    this.controller.create(req, res);
  }

  @Get()
  @ApiOperation({ summary: 'Listar categorias' })
  @UseGuards(cabCatModule)
  getAll(@Req() req: Request, @Res() res: Response): void {
    this.controller.getAll(req, res);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Categoria por id' })
  @ApiParam({ name: 'id', type: Number })
  @UseGuards(cabCatModule)
  getById(@Req() req: Request, @Res() res: Response): void {
    this.controller.getById(req, res);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar categoria' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: CategoryNomeBodyDto })
  @UseGuards(catNomeBody, cabCatModule)
  update(@Req() req: Request, @Res() res: Response): void {
    this.controller.update(req, res);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover categoria' })
  @ApiParam({ name: 'id', type: Number })
  @UseGuards(cabCatModule)
  delete(@Req() req: Request, @Res() res: Response): void {
    this.controller.delete(req, res);
  }
}

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
import { ResidentController } from '@controllers/residente.controller';
import { UseExpressMwGuard } from '@guards/express-middleware.guard';
import { requireModule } from '@middlewares/module.middleware';
import {
  validateCaselaParam,
  validatePagination,
} from '@middlewares/validation.middleware';
import {
  ResidentCreateBodyDto,
  ResidentUpdateBodyDto,
} from '@domain/dto/entities.api.dto';
import { UseValidatedBody } from '@validation/use-validated-body.guard';

const resModule = UseExpressMwGuard(requireModule('residents'));
const resPaginate = UseExpressMwGuard(
  validatePagination,
  requireModule('residents'),
);
const resCasela = UseExpressMwGuard(
  validateCaselaParam,
  requireModule('residents'),
);
const resCreateBody = UseValidatedBody(ResidentCreateBodyDto);
const resUpdateBody = UseValidatedBody(ResidentUpdateBodyDto);

@ApiTags('Residentes')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('residentes')
export class ResidenteApiController {
  constructor(private readonly controller: ResidentController) {}

  @Get()
  @ApiOperation({ summary: 'Listar residentes (paginado)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(resPaginate)
  findAll(@Req() req: Request, @Res() res: Response): void {
    this.controller.findAll(req, res);
  }

  @Get('count')
  @ApiOperation({ summary: 'Contagem de residentes' })
  @UseGuards(resModule)
  count(@Req() req: Request, @Res() res: Response): void {
    this.controller.getCount(req, res);
  }

  @Get(':casela')
  @ApiOperation({ summary: 'Residente por número de casela' })
  @ApiParam({ name: 'casela', type: Number })
  @UseGuards(resCasela)
  findByCasela(@Req() req: Request, @Res() res: Response): void {
    this.controller.findByCasela(req, res);
  }

  @Post()
  @ApiOperation({ summary: 'Criar residente' })
  @ApiBody({ type: ResidentCreateBodyDto })
  @UseGuards(resCreateBody, resModule)
  create(@Req() req: Request, @Res() res: Response): void {
    this.controller.create(req, res);
  }

  @Put(':casela')
  @ApiOperation({ summary: 'Atualizar residente' })
  @ApiParam({ name: 'casela', type: Number })
  @ApiBody({ type: ResidentUpdateBodyDto })
  @UseGuards(resUpdateBody, resCasela)
  update(@Req() req: Request, @Res() res: Response): void {
    this.controller.update(req, res);
  }

  @Delete(':casela')
  @ApiOperation({ summary: 'Remover residente' })
  @ApiParam({ name: 'casela', type: Number })
  @UseGuards(resCasela)
  delete(@Req() req: Request, @Res() res: Response): void {
    this.controller.delete(req, res);
  }
}

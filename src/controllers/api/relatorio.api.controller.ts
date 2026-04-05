import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ReportController } from '@controllers/relatorio.controller';
import { UseExpressMwGuard } from '@guards/express-middleware.guard';
import { requireModule } from '@middlewares/module.middleware';

const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Muitos relatórios gerados. Tente novamente em 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const reportGuard = UseExpressMwGuard(reportLimiter, requireModule('reports'));

@ApiTags('Relatórios')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('relatorios')
export class RelatorioApiController {
  constructor(private readonly controller: ReportController) {}

  @Get()
  @ApiOperation({
    summary: 'Gerar relatório',
    description: 'Parâmetros de filtro via query (tipo, datas, etc.).',
  })
  @ApiQuery({ name: 'tipo', required: false })
  @ApiQuery({ name: 'data_inicial', required: false })
  @ApiQuery({ name: 'data_final', required: false })
  @UseGuards(reportGuard)
  generate(@Req() req: Request, @Res() res: Response): void {
    void this.controller.generate(req, res);
  }
}

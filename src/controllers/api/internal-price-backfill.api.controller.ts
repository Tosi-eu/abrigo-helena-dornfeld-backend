import { Controller, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { getErrorMessage } from '@domain/error.types';
import { runScheduledPriceBackfillForAllTenants } from '@services/price-backfill-scheduled.runner';

/**
 * Chamadas serviço-a-serviço (ex.: cron na API Price Search).
 * Protegido por `INTERNAL_PRICE_BACKFILL_SECRET` — não usa JWT de utilizador.
 */
@ApiTags('Internal')
@Controller('internal/price-backfill')
export class InternalPriceBackfillApiController {
  @Post('cron')
  @ApiOperation({
    summary:
      'Executar uma rodada agendada de backfill de preços (todos os tenants elegíveis)',
  })
  async cron(@Req() req: Request, @Res() res: Response): Promise<Response> {
    const expected = process.env.INTERNAL_PRICE_BACKFILL_SECRET?.trim();
    const got =
      req.header('x-internal-secret')?.trim() ??
      req.header('X-Internal-Secret')?.trim();

    if (!expected || got !== expected) {
      return res.status(401).json({
        error: 'Não autorizado',
        code: 'INTERNAL_SECRET_MISMATCH',
      });
    }

    try {
      const result = await runScheduledPriceBackfillForAllTenants();
      return res.json(result);
    } catch (error: unknown) {
      return res.status(500).json({
        error:
          getErrorMessage(error) ||
          'Falha ao executar busca retroativa agendada.',
      });
    }
  }
}

import { Controller, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { getErrorMessage } from '@domain/error.types';
import { runScheduledPriceBackfillForAllTenants } from '@services/price-backfill-scheduled.runner';

@ApiTags('Internal')
@Controller('internal/price-backfill')
export class InternalPriceBackfillApiController {
  @Post('cron')
  @ApiOperation({
    summary:
      'Executar uma rodada agendada de backfill de preços (todos os tenants elegíveis)',
  })
  async cron(@Req() req: Request, @Res() res: Response): Promise<Response> {
    const expected = process.env.X_API_KEY?.trim();
    const got = req.header('x-api-key')?.trim();

    if (!expected) {
      return res.status(503).json({
        error: 'Servidor sem X_API_KEY configurado',
        code: 'X_API_KEY_MISSING',
      });
    }
    if (got !== expected) {
      return res.status(401).json({
        error: 'Não autorizado',
        code: 'API_KEY_MISMATCH',
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

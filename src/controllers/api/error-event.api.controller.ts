import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { optionalAuthMiddleware } from '@middlewares/auth.middleware';
import { requireSuperAdminOrApiKey } from '@middlewares/super-admin.middleware';
import { bindSuperAdminRlsTransaction } from '@middlewares/request-rls-transaction.middleware';
import { errorIngestAuthMiddleware } from '@middlewares/error-ingest-auth.middleware';
import { CanonicalErrorPayloadSchema } from '@validation/error-event-ingest.dto';
import { getErrorEventService } from '@services/error-event.service';
import type { AuthRequest } from '@middlewares/auth.middleware';

const systemTenantsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: {
    error: 'Muitas requisições. Tente novamente em breve.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const adminTenantsChain = UseExpressMwGuard(
  bindSuperAdminRlsTransaction,
  systemTenantsLimiter,
  optionalAuthMiddleware,
  requireSuperAdminOrApiKey,
);

const errorIngestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Demasiados relatórios de erro. Tente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const errorIngestChain = UseExpressMwGuard(
  optionalAuthMiddleware,
  errorIngestAuthMiddleware,
  errorIngestLimiter,
);

@ApiTags('Erros')
@Controller()
export class ErrorEventApiController {
  private readonly errorEvents = getErrorEventService();

  @Post('internal/errors')
  @ApiOperation({ summary: 'Ingerir evento de erro (JWT ou X-API-Key)' })
  @ApiSecurity('bearer')
  @ApiBody({ description: 'Payload canónico de erro' })
  @UseGuards(errorIngestChain)
  async ingest(
    @Req() req: AuthRequest,
    @Res() res: Response,
  ): Promise<Response> {
    const parsed = CanonicalErrorPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Payload inválido',
        details: parsed.error.flatten(),
      });
    }

    const body = parsed.data;
    const authReq = req as AuthRequest;
    if (authReq.user?.tenantId != null && body.tenantId == null) {
      (body as { tenantId: number }).tenantId = authReq.user.tenantId;
    }

    await this.errorEvents.recordCanonical(body);
    return res.status(201).json({ ok: true });
  }

  @Get('admin/error-events/summary')
  @ApiOperation({ summary: '[Super-admin] Resumo agregado de erros' })
  @ApiSecurity('bearer')
  @UseGuards(adminTenantsChain)
  async summary(@Res() res: Response): Promise<Response> {
    const data = await this.errorEvents.summary();
    return res.json(data);
  }

  @Get('admin/error-events')
  @ApiOperation({ summary: '[Super-admin] Listar eventos de erro' })
  @ApiSecurity('bearer')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'code', required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'correlationId', required: false })
  @UseGuards(adminTenantsChain)
  async list(
    @Req() _req: Request,
    @Res() res: Response,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('source') source?: string,
    @Query('severity') severity?: string,
    @Query('category') category?: string,
    @Query('code') code?: string,
    @Query('tenantId') tenantIdRaw?: string,
    @Query('from') fromRaw?: string,
    @Query('to') toRaw?: string,
    @Query('q') q?: string,
    @Query('correlationId') correlationId?: string,
  ): Promise<Response> {
    const page = Math.max(1, Number(pageRaw) || 1);
    const limit = Math.min(100, Math.max(1, Number(limitRaw) || 25));
    const tenantId =
      tenantIdRaw != null && tenantIdRaw !== ''
        ? Number(tenantIdRaw)
        : undefined;
    const from = fromRaw && fromRaw.trim() ? new Date(fromRaw) : undefined;
    const to = toRaw && toRaw.trim() ? new Date(toRaw) : undefined;

    const result = await this.errorEvents.list(
      {
        source: source?.trim() || undefined,
        severity: severity?.trim() || undefined,
        category: category?.trim() || undefined,
        code: code?.trim() || undefined,
        tenantId:
          tenantId != null && Number.isInteger(tenantId) ? tenantId : undefined,
        from: from && !Number.isNaN(from.getTime()) ? from : undefined,
        to: to && !Number.isNaN(to.getTime()) ? to : undefined,
        q: q?.trim() || undefined,
        correlationId: correlationId?.trim() || undefined,
      },
      page,
      limit,
    );

    return res.json({
      data: result.rows,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  }

  @Get('admin/error-events/:id')
  @ApiOperation({ summary: '[Super-admin] Detalhe de um evento de erro' })
  @ApiSecurity('bearer')
  @ApiParam({ name: 'id' })
  @UseGuards(adminTenantsChain)
  async detail(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<Response> {
    const row = await this.errorEvents.getById(id);
    if (!row) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }
    return res.json(row);
  }
}

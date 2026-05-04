import { Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ApiBody, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { optionalAuthMiddleware } from '@middlewares/auth.middleware';
import { errorIngestAuthMiddleware } from '@middlewares/error-ingest-auth.middleware';
import type { Prisma } from '@prisma/client';
import { PricingAuditIngestSchema } from '@validation/pricing-audit-ingest.dto';
import { PrismaAuditRepository } from '@repositories/audit.repository';
import { logger } from '@helpers/logger.helper';

const pricingAuditLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  message: { error: 'Muitos eventos de auditoria. Tente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const pricingAuditChain = UseExpressMwGuard(
  optionalAuthMiddleware,
  errorIngestAuthMiddleware,
  pricingAuditLimiter,
);

@ApiTags('Auditoria interna')
@Controller()
export class PricingAuditApiController {
  private readonly auditRepo = new PrismaAuditRepository();

  @Post('internal/pricing-audit')
  @ApiOperation({ summary: 'Registar auditoria da API de preços (JWT ou X-API-Key)' })
  @ApiSecurity('bearer')
  @ApiBody({ description: 'Evento de auditoria (serviço price-search)' })
  @UseGuards(pricingAuditChain)
  async ingest(@Req() req: Request, @Res() res: Response): Promise<Response> {
    const parsed = PricingAuditIngestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Payload inválido',
        details: parsed.error.flatten(),
      });
    }

    const b = parsed.data;
    try {
      await this.auditRepo.create({
        user_id: b.user_id ?? null,
        tenant_id: b.tenant_id ?? null,
        method: b.method,
        path: b.path,
        operation_type: b.operation_type,
        resource: b.resource,
        status_code: b.status_code,
        duration_ms: b.duration_ms,
        old_value: b.old_value as Prisma.InputJsonValue | null | undefined,
        new_value: b.new_value as Prisma.InputJsonValue | null | undefined,
      });
      return res.status(201).json({ ok: true });
    } catch (err) {
      logger.error('pricing_audit_ingest_failed', {
        operation: 'pricing_audit',
        err: (err as Error).message,
      });
      return res.status(500).json({ error: 'Falha ao gravar auditoria' });
    }
  }
}

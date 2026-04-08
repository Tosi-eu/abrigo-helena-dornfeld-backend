import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { TenantRequest } from '@middlewares/tenant.middleware';

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): number => {
    const req = ctx.switchToHttp().getRequest<TenantRequest>();
    const raw = req?.tenant?.id;
    if (raw == null) {
      throw new ForbiddenException('Tenant não identificado');
    }
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('Tenant inválido');
    }
    return id;
  },
);


import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiSecurity } from '@nestjs/swagger';

/** Sessão JWT em cookie `authToken` e/ou header Bearer (conforme middleware). */
export function ApiTenantSessionAuth() {
  return applyDecorators(
    ApiSecurity('bearer'),
    ApiCookieAuth('authToken'),
  );
}

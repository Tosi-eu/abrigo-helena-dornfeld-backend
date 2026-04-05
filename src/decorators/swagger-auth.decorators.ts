import { applyDecorators } from '@nestjs/common';
import { ApiCookieAuth, ApiSecurity } from '@nestjs/swagger';

export function ApiTenantSessionAuth() {
  return applyDecorators(
    ApiSecurity('bearer'),
    ApiCookieAuth('authToken'),
  );
}

import { App } from 'supertest/types';
import {
  E2E_TENANT_SLUG,
  E2E_SEED_USER,
} from '@helpers/e2e-tenant-seed.helper';
import { getAuthTokenForE2EApp } from '@helpers/e2e-auth-token.helper';

export { E2E_TENANT_SLUG, E2E_SEED_USER };

export async function getAuthToken(app: App): Promise<string> {
  return getAuthTokenForE2EApp(app);
}

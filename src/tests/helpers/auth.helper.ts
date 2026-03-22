import request from 'supertest';
import { App } from 'supertest/types';
import { E2E_TENANT_SLUG } from '../../infrastructure/helpers/e2e-tenant-seed.helper';

const E2E_USER = { login: 'e2e_user', password: 'senha1234' };

export { E2E_TENANT_SLUG };

export async function getAuthCookie(app: App): Promise<string> {
  await request(app)
    .post('/api/v1/login')
    .set('X-Tenant', E2E_TENANT_SLUG)
    .send(E2E_USER);
  const res = await request(app)
    .post('/api/v1/login/authenticate')
    .set('X-Tenant', E2E_TENANT_SLUG)
    .send(E2E_USER);
  if (res.status !== 200) {
    throw new Error(
      `Falha ao autenticar no e2e: ${res.body?.error ?? res.status}`,
    );
  }
  const setCookie = res.headers['set-cookie']?.[0];
  if (!setCookie) throw new Error('Cookie de auth não retornado');
  return setCookie.split(';')[0].trim();
}

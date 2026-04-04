import request from 'supertest';
import { App } from 'supertest/types';
import {
  E2E_TENANT_SLUG,
  E2E_SEED_USER,
} from './e2e-tenant-seed.helper';

const E2E_USER = {
  login: E2E_SEED_USER.login,
  password: E2E_SEED_USER.password,
};

export async function getAuthTokenForE2EApp(app: App): Promise<string> {
  const res = await request(app)
    .post('/api/v1/login/authenticate')
    .set('X-Tenant', E2E_TENANT_SLUG)
    .send(E2E_USER);
  if (res.status !== 200) {
    const detail =
      typeof res.body?.error === 'string'
        ? res.body.error
        : res.text?.slice(0, 200) || JSON.stringify(res.body);
    throw new Error(`Falha ao autenticar no e2e (${res.status}): ${detail}`);
  }
  const token = res.body?.token;
  if (!token) throw new Error('Token de auth não retornado');
  return String(token);
}

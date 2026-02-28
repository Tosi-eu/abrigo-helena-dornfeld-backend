import request from 'supertest';
import { App } from 'supertest/types';

const E2E_USER = { login: 'e2e_user', password: 'senha1234' };

/**
 * Cria um usuário e retorna o cookie de autenticação para usar em requisições protegidas.
 * Usar em beforeAll dos testes e2e que precisam de auth.
 */
export async function getAuthCookie(app: App): Promise<string> {
  await request(app).post('/api/v1/login').send(E2E_USER);
  const res = await request(app)
    .post('/api/v1/login/authenticate')
    .send(E2E_USER);
  if (res.status !== 200) {
    throw new Error(`Falha ao autenticar no e2e: ${res.body?.error ?? res.status}`);
  }
  const cookie = res.headers['set-cookie']?.[0];
  if (!cookie) throw new Error('Cookie de auth não retornado');
  return cookie;
}

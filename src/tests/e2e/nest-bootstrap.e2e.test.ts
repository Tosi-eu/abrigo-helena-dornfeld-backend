import request from 'supertest';
import type { App } from 'supertest/types';
import { createApp, closeTestApp } from '@tests/helpers/database.helper';

describe('Nest bootstrap', () => {
  let app: App;

  beforeAll(async () => {
    app = (await createApp()) as unknown as App;
  });

  afterAll(async () => {
    await closeTestApp();
  });

  it('expõe /api/v1/health', async () => {
    const res = await request(app).get('/api/v1/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
  });
});

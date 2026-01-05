import { App } from 'supertest/types';
import { setupTestApp } from '../../infrastructure/helpers/database.helper';
import request from 'supertest';

describe('Resident E2E - CRUD básico', () => {
  let createdCasela: number;
  let app: App;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  it('deve criar um residente', async () => {
    const res = await request(app)
      .post('/api/v1/residentes')
      .send({ casela: 10, nome: 'Fulano' });

    expect(res.status).toBe(201);
    expect(res.body.casela).toBe(10);

    createdCasela = res.body.casela;
  });

  it('deve atualizar um residente', async () => {
    const res = await request(app)
      .put(`/api/v1/residentes/${createdCasela}`)
      .send({ nome: 'Fulano Atualizado' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Fulano Atualizado');
  });

  it('não deve atualizar com nome inválido', async () => {
    const res = await request(app)
      .put(`/api/v1/residentes/${createdCasela}`)
      .send({ nome: '' });

    expect(res.status).toBe(400);
  });

  it('deve remover um residente', async () => {
    const res = await request(app).delete(`/api/v1/residentes/${createdCasela}`);
    expect(res.status).toBe(204);
  });

  it('não deve remover novamente', async () => {
    const res = await request(app).delete(`/api/v1/residentes/${createdCasela}`);
    expect(res.status).toBe(404);
  });
});

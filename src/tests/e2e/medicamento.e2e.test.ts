import request from 'supertest';
import { setupTestApp } from '../../infrastructure/helpers/database.helper';
import { getAuthCookie } from '../helpers/auth.helper';
import { App } from 'supertest/types';

describe('Medicines E2E - CRUD básico', () => {
  let createdId: number;
  let app: App;
  let authCookie: string;

  beforeAll(async () => {
    app = await setupTestApp();
    authCookie = await getAuthCookie(app);
  });

  it('deve criar um medicamento', async () => {
    const response = await request(app)
      .post('/api/v1/medicamentos')
      .set('Cookie', authCookie)
      .send({
      nome: 'Dipirona Sódica',
      dosagem: 500,
      unidade_medida: 'mg',
      estoque_minimo: 10,
      principio_ativo: 'Dipirona',
    });

    expect(response.status).toBe(201);

    createdId = response.body.id;
  });

  it('deve atualizar um medicamento', async () => {
    const response = await request(app)
      .put(`/api/v1/medicamentos/${createdId}`)
      .send({
        nome: 'Dipirona Atualizada',
        dosagem: 500,
        unidade_medida: 'mg',
        estoque_minimo: 5,
        principio_ativo: 'Dipirona',
      });

    expect(response.status).toBe(200);
    expect(response.body.nome).toBe('Dipirona Atualizada');
  });

  it('não deve atualizar com campos inválidos', async () => {
    const response = await request(app)
      .put(`/api/v1/medicamentos/${createdId}`)
      .set('Cookie', authCookie)
      .send({
        nome: '',
        dosagem: -10,
      });

    expect(response.status).toBe(400);
  });

  it('deve remover um medicamento', async () => {
    const response = await request(app)
      .delete(`/api/v1/medicamentos/${createdId}`)
      .set('Cookie', authCookie);

    expect(response.status).toBe(204);
  });

  it('deve retornar erro ao tentar remover novamente', async () => {
    const response = await request(app)
      .delete(`/api/v1/medicamentos/${createdId}`)
      .set('Cookie', authCookie);

    expect(response.status).toBe(404);
  });
});

import request from 'supertest';
import { App } from 'supertest/types';
import {
  E2E_TENANT_SLUG,
  E2E_SEED_USER,
} from '../../helpers/e2e-tenant-seed.helper';

export interface SeedResult {
  categoryId: number;
  medicineId: number;
  inputId: number;
  cabinetId: number;
  residentCasela: number;
  cookie: string;
}

export async function seedDB(app: App): Promise<SeedResult> {
  const authRes = await request(app)
    .post('/api/v1/login/authenticate')
    .set('X-Tenant', E2E_TENANT_SLUG)
    .send({
      login: E2E_SEED_USER.login,
      password: E2E_SEED_USER.password,
    });
  if (authRes.status !== 200) {
    throw new Error(
      `seedDB: falha ao autenticar ${E2E_SEED_USER.login}: ${authRes.body?.error ?? authRes.status}`,
    );
  }
  const setCookie = authRes.headers['set-cookie']?.[0] ?? '';
  const cookie = setCookie ? setCookie.split(';')[0].trim() : '';
  if (!cookie) {
    throw new Error('seedDB: cookie de sessão não retornado após authenticate');
  }

  const catRes = await request(app)
    .post('/api/v1/categoria-armario')
    .set('Cookie', cookie)
    .send({
      nome: 'Categoria de Teste',
    });

  if (catRes.status !== 201)
    throw new Error('Erro ao criar categoria no seedDB');
  const categoryId = catRes.body.id;

  const medRes = await request(app)
    .post('/api/v1/medicamentos')
    .set('Cookie', cookie)
    .send({
      nome: 'Dipirona',
      dosagem: '500',
      unidade_medida: 'mg',
      estoque_minimo: 10,
      principio_ativo: 'Dipirona',
    });

  if (medRes.status !== 201)
    throw new Error('Erro ao criar medicamento no seedDB');
  const medicineId = medRes.body.id;

  const inputRes = await request(app)
    .post('/api/v1/insumos')
    .set('Cookie', cookie)
    .send({
      nome: 'Gaze Estéril',
      descricao: 'Gaze para curativos',
      estoque_minimo: 50,
    });

  if (inputRes.status !== 201)
    throw new Error('Erro ao criar insumo no seedDB');
  const inputId = inputRes.body.id;

  const cabRes = await request(app)
    .post('/api/v1/armarios')
    .set('Cookie', cookie)
    .send({
      numero: 1,
      categoria_id: categoryId,
    });

  if (cabRes.status !== 201) throw new Error('Erro ao criar armário no seedDB');
  const cabinetId = cabRes.body.numero;

  const resRes = await request(app)
    .post('/api/v1/residentes')
    .set('Cookie', cookie)
    .send({
      casela: 101,
      nome: 'Fulano Teste',
    });

  if (resRes.status !== 201)
    throw new Error('Erro ao criar residente no seedDB');
  const residentCasela = resRes.body.casela;

  return {
    categoryId,
    medicineId,
    inputId,
    cabinetId,
    residentCasela,
    cookie,
  };
}

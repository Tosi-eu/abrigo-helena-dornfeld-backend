import request from 'supertest';
import { App } from 'supertest/types';
import { getAuthTokenForE2EApp } from '@helpers/e2e-auth-token.helper';

export interface SeedResult {
  categoryId: number;
  medicineId: number;
  inputId: number;
  cabinetId: number;
  residentId: number;
  residentCasela: number;
  token: string;
}

export async function seedDB(app: App): Promise<SeedResult> {
  const token = await getAuthTokenForE2EApp(app);
  const auth = () => ({ Authorization: `Bearer ${token}` });

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const cabinetNum = 600_000 + Math.floor(Math.random() * 200_000);
  const residentCaselaSeed = 500_000 + Math.floor(Math.random() * 200_000);

  const catRes = await request(app)
    .post('/api/v1/categoria-armario')
    .set(auth())
    .send({
      nome: `Categoria de Teste ${stamp}`,
    });

  if (catRes.status !== 201)
    throw new Error('Erro ao criar categoria no seedDB');
  const categoryId = catRes.body.id;

  const medRes = await request(app)
    .post('/api/v1/medicamentos')
    .set(auth())
    .send({
      nome: `Dipirona E2E ${stamp}`,
      dosagem: '500',
      unidade_medida: 'mg',
      estoque_minimo: 10,
      principio_ativo: `Dipirona PA ${stamp}`,
    });

  if (medRes.status !== 201)
    throw new Error('Erro ao criar medicamento no seedDB');
  const medicineId = medRes.body.id;

  const inputRes = await request(app)
    .post('/api/v1/insumos')
    .set(auth())
    .send({
      nome: `Gaze Estéril ${stamp}`,
      descricao: 'Gaze para curativos',
      estoque_minimo: 50,
    });

  if (inputRes.status !== 201)
    throw new Error('Erro ao criar insumo no seedDB');
  const inputId = inputRes.body.id;

  const cabRes = await request(app).post('/api/v1/armarios').set(auth()).send({
    numero: cabinetNum,
    categoria_id: categoryId,
  });

  if (cabRes.status !== 201) throw new Error('Erro ao criar armário no seedDB');
  const cabinetId = cabRes.body.numero;

  const resRes = await request(app)
    .post('/api/v1/residentes')
    .set(auth())
    .send({
      casela: residentCaselaSeed,
      nome: `Fulano Teste ${stamp}`,
    });

  if (resRes.status !== 201)
    throw new Error('Erro ao criar residente no seedDB');
  const residentId = Number(resRes.body.id);
  if (!residentId) throw new Error('Resposta de residente sem id no seedDB');
  const residentCasela = resRes.body.casela;

  return {
    categoryId,
    medicineId,
    inputId,
    cabinetId,
    residentId,
    residentCasela,
    token,
  };
}

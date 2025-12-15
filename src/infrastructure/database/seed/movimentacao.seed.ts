import request from 'supertest';
import { App } from 'supertest/types';
import { SeedResult } from './estoque.seed';

export interface SeedEntries {
  medStockId: number;
  inputStockId: number;
}

export async function seedEntriesDB(
  app: App,
  seed: SeedResult,
): Promise<SeedEntries> {
  const medEntry = await request(app).post('/api/estoque/entrada').send({
    medicamento_id: seed.medicineId,
    armario_id: seed.cabinetId,
    validade: '2099-12-31',
    quantidade: 20,
    origem: 'UBS',
    tipo: 'geral',
    casela_id: null,
  });

  if (medEntry.status !== 200)
    throw new Error('Erro ao criar entrada de medicamento no seedEntriesDB');

  const inputEntry = await request(app).post('/api/estoque/entrada').send({
    insumo_id: seed.inputId,
    armario_id: seed.cabinetId,
    validade: '2099-12-31',
    quantidade: 50,
    tipo: 'geral',
  });

  if (inputEntry.status !== 200)
    throw new Error('Erro ao criar entrada de insumo no seedEntriesDB');

  return {
    medStockId: medEntry.body.estoque_id,
    inputStockId: inputEntry.body.estoque_id,
  };
}

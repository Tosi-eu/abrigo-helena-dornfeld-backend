export interface MovementQueryParams {
  tenantId: number;
  days?: number;
  type?: string;
  page: number;
  limit: number;
}

export interface MovementRankingParams {
  tenantId: number;
  type: string;
  page: number;
  limit: number;
}

export interface CreateMovementData {
  tenant_id?: number;
  tipo: string;
  quantidade: number;
  armario_id?: number;
  gaveta_id?: number;
  login_id: number;
  medicamento_id?: number;
  insumo_id?: number;
  casela_id?: number;
  validade?: string | Date;
  setor?: 'farmacia' | 'enfermagem';
}

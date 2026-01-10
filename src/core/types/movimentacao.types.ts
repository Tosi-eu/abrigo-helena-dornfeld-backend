/**
 * Movement Service Types
 */
export interface MovementQueryParams {
  days?: number;
  type?: string;
  page: number;
  limit: number;
}

export interface MovementRankingParams {
  type: string;
  page: number;
  limit: number;
}

export interface CreateMovementData {
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



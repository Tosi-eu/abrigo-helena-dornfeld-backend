export interface MovementRankingRow {
  medicamento_id: number;
  total_entradas: number;
  total_saidas: number;
  qtd_entradas: number;
  qtd_saidas: number;
  total_movimentado: number;
  MedicineModel?: {
    id: number;
    nome: string;
    principio_ativo: string;
  } | null;
}

export interface MovementRankingResult {
  medicamento_id: number;
  total_entradas: number;
  total_saidas: number;
  qtd_entradas: number;
  qtd_saidas: number;
  total_movimentado: number;
  medicamento: {
    id: number;
    nome: string;
    principio_ativo: string;
  } | null;
}

export interface MovementRowWithAssociations {
  medicamento_id: number;
  total_entradas: number;
  total_saidas: number;
  qtd_entradas: number;
  qtd_saidas: number;
  total_movimentado: number;
  MedicineModel?: {
    id: number;
    nome: string;
    principio_ativo: string;
  } | null;
  [key: string]: unknown;
}


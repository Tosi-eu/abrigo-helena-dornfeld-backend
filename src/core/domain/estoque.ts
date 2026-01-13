import { OperationType, StockItemStatus } from '../utils/utils';

export interface MedicineStock {
  medicamento_id: number;
  armario_id?: number | null;
  gaveta_id?: number | null;
  validade: Date;
  quantidade: number;
  origem: string;
  tipo: OperationType;
  casela_id: number | null;
  setor: string;
  lote?: string | null;
  status?: StockItemStatus;
  suspended_at?: Date | null;
  observacao?: string | null;
  preco?: number | null;
}

export interface InputStock {
  insumo_id: number;
  casela_id?: number | null;
  armario_id?: number | null;
  gaveta_id?: number | null;
  quantidade: number;
  validade: Date;
  tipo: string;
  setor: string;
  lote?: string | null;
  status?: StockItemStatus;
  suspended_at?: Date | null;
  preco?: number | null;
}

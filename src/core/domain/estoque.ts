import { OperationType } from '../utils/utils';

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
}

export interface InputStock {
  insumo_id: number;
  armario_id?: number | null;
  gaveta_id?: number | null;
  quantidade: number;
  validade: Date;
  tipo: string;
  setor: string;
}

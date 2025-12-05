import { OperationType } from "../utils/utils";

export interface MedicineStock {
  medicamento_id: number;
  armario_id: number;
  validade: Date;
  quantidade: number;
  origem: string;
  tipo: OperationType;
  casela_id: number | null;
}

export interface InputStock {
  insumo_id: number;
  armario_id: number;
  quantidade: number;
  validade: Date;
  tipo: string;
}
import { MovementType } from "../../../core/enum/enum";

export interface MedicineReport {
  medicamento: string;
  principio_ativo: string;
  quantidade: number;
  validade: string;
  residente: string | null;
}

export interface InputReport {
  insumo: string;
  quantidade: number;
  armario: number;
}

export interface ResidentReport {
  residente: string;
  casela: number;
  medicamento: string;
  principio_ativo: string | null;
  quantidade: number;
  validade: string | null;
}

export interface AllItemsReport {
  medicamentos: MedicineReport[];
  insumos: InputReport[];
}

export interface PsicotropicoData {
  tipo: MovementType;
  medicamento: string;  
  residente: string;       
  data_movimentacao: string;
  quantidade: number;
}

export interface PsicotropicosReport {
  psicotropico: PsicotropicoData[]
}

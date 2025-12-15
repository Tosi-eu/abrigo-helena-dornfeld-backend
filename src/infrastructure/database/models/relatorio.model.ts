import { MovementType } from "../../../core/utils/utils";


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
  validade: Date;
}

export interface ResidentReport {
  residente: string;
  casela: number;
  medicamento: string;
  principio_ativo: string | null;
  quantidade: number;
  validade: Date;
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

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

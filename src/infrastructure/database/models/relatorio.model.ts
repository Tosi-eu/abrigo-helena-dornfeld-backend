export interface RelatorioMedicamento {
  medicamento: string;
  principio_ativo: string | null;
  quantidade: number;
  validade: string | null;
  residente: string | null;
}

export interface RelatorioInsumo {
  insumo: string;
  quantidade: number;
  armario: number;
}

export interface RelatorioResidente {
  residente: string;
  casela: number;
  medicamento: string;
  principio_ativo: string | null;
  quantidade: number;
  validade: string | null;
}

export interface RelatorioCombo {
  medicamentos: RelatorioMedicamento[];
  insumos: RelatorioInsumo[];
}

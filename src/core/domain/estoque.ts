export interface EstoqueMedicamento {
  medicamento_id: number;
  casela_id?: number | null;
  armario_id: number;
  validade?: Date | null;
  quantidade: number;
  origem?: string | null;
  tipo?: "individual" | "geral";
}

export interface EstoqueInsumo {
  insumo_id: number;
  armario_id: number;
  quantidade: number;
}

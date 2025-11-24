export interface EstoqueMedicamento {
  medicamento_id: number;
  armario_id: number;
  validade: Date;
  quantidade: number;
  origem: string;
  tipo: "individual" | "geral";
  casela_id: number | null;
}

export interface EstoqueInsumo {
  insumo_id: number;
  armario_id: number;
  quantidade: number;
}

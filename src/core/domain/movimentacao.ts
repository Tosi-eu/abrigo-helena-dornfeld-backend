export interface Movimentacao {
  tipo: "entrada" | "saida"; 
  login_id: number;
  armario_id: number;
  quantidade: number;
  insumo_id?: number | null;
  medicamento_id?: number | null;
  casela_id?: number | null;
  validade_medicamento?: Date | null;
}
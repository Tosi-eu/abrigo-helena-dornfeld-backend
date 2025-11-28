import { OperationType } from "../enum/enum";

export class Movement {
  tipo: OperationType;
  login_id: number;
  armario_id: number;
  quantidade: number;
  insumo_id?: number | null;
  medicamento_id?: number | null;
  casela_id?: number | null;
  validade_medicamento?: Date | null;

  constructor(
    data: {
      tipo: OperationType;
      login_id: number;
      armario_id: number;
      quantidade: number;
      insumo_id?: number | null;
      medicamento_id?: number | null;
      casela_id?: number | null;
      validade_medicamento?: Date | null;
  }) {
    this.tipo = data.tipo;
    this.login_id = data.login_id;
    this.armario_id = data.armario_id;
    this.quantidade = data.quantidade;
    this.insumo_id = data.insumo_id ?? null;
    this.medicamento_id = data.medicamento_id ?? null;
    this.casela_id = data.casela_id ?? null;
    this.validade_medicamento = data.validade_medicamento ?? null;
  }
}

export default Movement;

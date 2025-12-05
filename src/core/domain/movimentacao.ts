import { OperationType } from "../utils/utils";

export interface Movement {
  tipo: OperationType;
  login_id: number;
  armario_id: number;
  quantidade: number;
  insumo_id?: number | null;
  medicamento_id?: number | null;
  casela_id?: number | null;
  validade: Date;
}

export default Movement;

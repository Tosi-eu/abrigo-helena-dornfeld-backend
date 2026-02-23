import { MovementType } from '../utils/utils';

export interface Movement {
  tipo: MovementType;
  login_id: number;
  armario_id?: number;
  gaveta_id?: number;
  quantidade: number;
  insumo_id?: number | null;
  medicamento_id?: number | null;
  casela_id?: number | null;
  validade: Date;
  setor: string;
  destino?: string | null;
  lote?: string | null;
  observacao?: string | null;
}

export default Movement;

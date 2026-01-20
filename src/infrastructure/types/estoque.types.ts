import { OperationType, SectorType } from "../../core/utils/utils";

export interface StockQueryResult {
  id?: number;
  nome?: string;
  quantidade?: number;
  validade: Date;
  minimo?: number;
  armario_id?: number;
  gaveta_id?: number;
  tipo: string;
  [key: string]: unknown;
}

export type StockGroup =
  | 'medicamentos_geral'
  | 'medicamentos_individual'
  | 'insumos_geral'
  | 'insumos_individual'
  | 'carrinho_medicamentos'
  | 'carrinho_insumos';

export type SectorConfig = {
  medicines: Partial<Record<StockGroup, OperationType[]>>;
  inputs: Partial<Record<StockGroup, OperationType[]>>;
};

export const SECTOR_CONFIG: Record<SectorType, SectorConfig> = {
  [SectorType.FARMACIA]: {
    medicines: {
      medicamentos_geral: [OperationType.GERAL],
      medicamentos_individual: [OperationType.INDIVIDUAL],
    },
    inputs: {
      insumos_geral: [OperationType.GERAL],
      insumos_individual: [OperationType.INDIVIDUAL],
    },
  },

  [SectorType.ENFERMAGEM]: {
    medicines: {
      medicamentos_geral: [OperationType.GERAL],
      medicamentos_individual: [OperationType.INDIVIDUAL],
      carrinho_medicamentos: [
        OperationType.CARRINHO_EMERGENCIA,
        OperationType.CARRINHO_PSICOTROPICOS,
      ],
    },
    inputs: {
      insumos_geral: [OperationType.GERAL],
      insumos_individual: [OperationType.INDIVIDUAL],
      carrinho_insumos: [
        OperationType.CARRINHO_EMERGENCIA,
        OperationType.CARRINHO_PSICOTROPICOS,
      ],
    },
  },
};

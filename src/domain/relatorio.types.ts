import { MovementType } from '@helpers/utils';

export interface MedicineReport {
  medicamento: string;
  principio_ativo: string;
  quantidade: number;
  validade: string;
  data_entrada?: Date | string | null;
  data_saida?: Date | string | null;
  residente: string | null;
}

export interface InputReport {
  insumo: string;
  quantidade: number;
  armario: number;
  validade: Date;
  data_entrada?: Date | string | null;
  data_saida?: Date | string | null;
  residente: string | null;
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
  psicotropico: PsicotropicoData[];
}

export interface ResidentConsumptionMedicine {
  nome: string;
  principio_ativo: string;
  preco_formatado: string;
  quantidade_estoque: number;
  observacao?: string | null;
}

export interface ResidentConsumptionInput {
  nome: string;
  descricao: string | null;
  preco_formatado: string;
  quantidade_estoque: number;
}

export interface ResidentConsumptionReport {
  residente: string;
  casela: number;
  medicamentos: ResidentConsumptionMedicine[];
  insumos: ResidentConsumptionInput[];
  custos_medicamentos: {
    item: string;
    nome: string;
    custo_mensal_formatado: string;
    custo_anual_formatado: string;
  }[];
  custos_insumos: {
    item: string;
    nome: string;
    custo_mensal_formatado: string;
    custo_anual_formatado: string;
  }[];
  total_estimado_formatado: string;
}

export interface TransferReport {
  data: string;
  nome: string;
  principio_ativo?: string | null;
  descricao?: string | null;
  quantidade: number;
  casela: number | null;
  residente: string | null;
  armario: number | null;
  lote: string | null;
  destino: string | null;
  observacao: string | null;
}

export interface MovementReport {
  data: string;
  tipo_movimentacao: 'entrada' | 'saida' | 'transferencia';
  nome: string;
  principio_ativo: string | null;
  descricao: string | null;
  quantidade: number;
  casela: number | null;
  residente: string | null;
  armario: number | null;
  gaveta: number | null;
  setor: string;
  lote: string | null;
  destino: string | null;
  observacao: string | null;
}

export interface ResidentMedicinesReport {
  residente: string;
  casela: number;
  medicamento: string;
  principio_ativo: string;
  quantidade: number;
  validade: string;
}

export interface ExpiredMedicineReport {
  medicamento: string;
  principio_ativo: string;
  quantidade: number;
  validade: string;
  residente: string | null;
  dias_vencido: number;
  lote: string | null;
  setor: string;
}

export interface ExpiringSoonReport {
  tipo: 'medicamento' | 'insumo';
  nome: string;
  principio_ativo?: string | null;
  descricao?: string | null;
  quantidade: number;
  validade: string;
  dias_para_vencer: number;
  residente: string | null;
  lote: string | null;
  setor: string;
  armario?: number | null;
  gaveta?: number | null;
}

import { MovementType } from '../../../core/utils/utils';

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
  validade: Date;
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
  dosagem: string;
  unidade_medida: string;
  principio_ativo: string;
  preco: number | null;
  quantidade_estoque: number;
  observacao?: string | null;
}

export interface ResidentConsumptionInput {
  nome: string;
  descricao: string | null;
  preco: number | null;
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
    custo_mensal: number;
    custo_anual: number;
  }[];
  custos_insumos: {
    item: string;
    nome: string;
    custo_mensal: number;
    custo_anual: number;
  }[];
  total_estimado: number;
}

export interface TransferReport {
  data: string;
  tipo_item: 'medicamento' | 'insumo';
  nome: string;
  principio_ativo?: string | null;
  quantidade: number;
  casela: number | null;
  residente: string | null;
  armario: number | null;
  setor: string;
  lote: string | null;
}

export interface DailyMovementReport {
  data: string;
  tipo_movimentacao: 'entrada' | 'saida' | 'transferencia';
  tipo_item: 'medicamento' | 'insumo';
  nome: string;
  principio_ativo?: string | null;
  quantidade: number;
  casela: number | null;
  residente: string | null;
  armario: number | null;
  gaveta: number | null;
  setor: string;
  lote: string | null;
}

export interface ResidentMedicinesReport {
  residente: string;
  casela: number;
  medicamento: string;
  principio_ativo: string | null;
  quantidade: number;
  validade: string;
}

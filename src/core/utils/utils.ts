export enum OperationType {
  INDIVIDUAL = 'individual',
  GERAL = 'geral',
  CARRINHO = 'carrinho_emergencia',
}

export enum MovementType {
  ENTRADA = 'entrada',
  SAIDA = 'saida',
}

export enum ItemType {
  MEDICAMENTO = 'medicamento',
  INSUMO = 'insumo',
}

export enum MedicineStatus {
  ATIVO = 'active',
  SUSPENSO = 'suspended',
}

export enum NotificationDestiny {
  SUS = 'sus',
  FAMILY = 'familia',
  PHARMACY = 'farmacia',
}

export interface StockRawResponse {
  tipo_item: string;
  estoque_id: number;
  item_id: number;
  nome: string;
  principio_ativo?: string | null;
  validade: string;
  quantidade: number;
  minimo: number;
  origem: string;
  tipo: string;
  paciente?: string | null;
  armario_id: number;
  casela_id?: number | null;
  st_expiracao: string;
  msg_expiracao: string;
  st_quantidade: string;
  msg_quantidade: string;
}

export interface ResidentMonthlyUsage {
  residente: string;
  casela: number;
  medicamento: string;
  principio_ativo: string;
  data: Date;
  consumo_mensal: number;
}

export interface QueryPaginationParams {
  filter: string;
  type: string;
  page?: number;
  limit?: number;
}

export interface StockProportion {
  total_medicamentos: number;
  total_individuais: number;
  total_gerais: number;
  total_insumos: number;
  total_carrinho_medicamentos: number;
  total_carrinho_insumos: number;
}

export interface NonMovementedItem {
  tipo_item: ItemType;
  item_id: number;
  nome: string;
  detalhe: string | null;
  ultima_movimentacao: string | null;
  dias_parados: number;
}

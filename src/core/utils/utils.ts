export enum OperationType {
  INDIVIDUAL = 'individual',
  GERAL = 'geral',
  CARRINHO_EMERGENCIA = 'carrinho_emergencia',
  CARRINHO_PSICOTROPICOS = 'carrinho_psicotropicos',
}

export enum MovementType {
  ENTRADA = 'entrada',
  SAIDA = 'saida',
  TRANSFER = 'transferencia',
}

export enum ItemType {
  MEDICAMENTO = 'medicamento',
  INSUMO = 'insumo',
}

export enum StockItemStatus {
  ATIVO = 'active',
  SUSPENSO = 'suspended',
}

export enum SectorType {
  FARMACIA = 'farmacia',
  ENFERMAGEM = 'enfermagem',
}

export enum StockFilterType {
  NEAR_MIN = 'nearMin',
  BELOW_MIN = 'belowMin',
  EXPIRED = 'expired',
  EXPIRING_SOON = 'expiringSoon',
}

export enum StockQueryType {
  MEDICAMENTO = 'medicamento',
  INSUMO = 'insumo',
  ARMARIOS = 'armarios',
  GAVETAS = 'gavetas',
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
  name?: string;
  itemType?: string;
  cabinet?: string;
  drawer?: string;
  casela?: string;
  sector?: string;
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
  item_id: number;
  nome: string;
  detalhe: string | null;
  ultima_movimentacao: string | null;
  dias_parados: number;
}

export interface PriceSourceStrategy {
  readonly sourceName: string;

  supports(itemType: 'medicine' | 'input'): boolean;

  fetchPrices(params: {
    itemName: string;
    dosage?: string;
    measurementUnit?: string;
  }): Promise<number[]>;
}

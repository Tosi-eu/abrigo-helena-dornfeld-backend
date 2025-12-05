export enum OperationType {
  INDIVIDUAL = "individual",
  GERAL = "geral",
  CARRINHO = "carrinho_emergencia"
}

export enum MovementType {
    ENTRADA = "entrada",
    SAIDA = "saida"
}

export enum ItemType {
  MEDICAMENTO = "medicamento",
  INSUMO = "insumo"
}

export interface StockRawResponse {
  tipo_item: string,
  estoque_id: number,
  item_id: number,
  nome: string,
  principio_ativo?: string | null,
  validade: string,
  quantidade: number,
  minimo: number,
  origem: string,
  tipo: string,
  paciente?: string | null,
  armario_id: number,
  casela_id?: number | null,
  st_expiracao: string,
  msg_expiracao: string,
  st_quantidade: string,
  msg_quantidade: string
}
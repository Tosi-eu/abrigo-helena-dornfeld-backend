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

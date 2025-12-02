export interface Medicine {
  nome: string;
  dosagem: number;
  unidade_medida: string;
  estoque_minimo?: number;
  principio_ativo: string;
}

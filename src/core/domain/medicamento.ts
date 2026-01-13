export interface Medicine {
  id?: number;
  nome: string;
  dosagem: string;
  unidade_medida: string;
  estoque_minimo?: number;
  principio_ativo: string;
  preco?: number | null;
}

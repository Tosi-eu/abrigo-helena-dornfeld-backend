export class Medicine {
  id: number;
  nome: string;
  dosagem: number;
  unidade_medida: string;
  estoque_minimo: number;
  principio_ativo?: string | null;

  constructor(
    id: number,
    nome: string,
    dosagem: number,
    unidade_medida: string,
    estoque_minimo: number,
    principio_ativo?: string | null
  ) {
    this.id = id;
    this.nome = nome;
    this.dosagem = dosagem;
    this.unidade_medida = unidade_medida;
    this.estoque_minimo = estoque_minimo;
    this.principio_ativo = principio_ativo ?? null;
  }
}

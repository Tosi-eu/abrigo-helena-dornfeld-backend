export class Insumo {
  id: number;
  nome: string;
  descricao?: string;

  constructor(id: number, nome: string, descricao?: string) {
    this.nome = nome;
    this.descricao = descricao;
    this.id = id;
  }
}
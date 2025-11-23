export class Medicamento {
  constructor(
    public id: number,
    public nome: string,
    public dosagem: number,
    public unidade_medida: string,
    public estoque_minimo: number,
    public principio_ativo?: string | null,
  ) {}
}
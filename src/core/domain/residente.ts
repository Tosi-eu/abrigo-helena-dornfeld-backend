export class Residente {
  constructor(
    public numCasela: number,
    public nome: string
  ) {}

  validate() {
    if (!this.numCasela || !Number.isInteger(this.numCasela) || this.numCasela <= 0) {
      throw new Error("Número de casela inválido");
    }

    if (!this.nome || typeof this.nome !== "string" || this.nome.trim() === "") {
      throw new Error("Nome inválido");
    }
  }

  toJSON() {
    return {
      casela: this.numCasela,
      name: this.nome,
    };
  }
}

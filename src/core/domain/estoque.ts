import { OperationType } from "../enum/enum";

export class MedicineStock {
  medicamento_id: number;
  armario_id: number;
  validade: Date;
  quantidade: number;
  origem: string;
  tipo: OperationType;
  casela_id: number | null;

  constructor(
    medicamento_id: number,
    armario_id: number,
    validade: Date,
    quantidade: number,
    origem: string,
    tipo: OperationType,
    casela_id: number | null
  ) {
    this.medicamento_id = medicamento_id;
    this.armario_id = armario_id;
    this.validade = validade;
    this.quantidade = quantidade;
    this.origem = origem;
    this.tipo = tipo;
    this.casela_id = casela_id;
  }
}

export class InputStock {
  insumo_id: number;
  armario_id: number;
  quantidade: number;

  constructor(insumo_id: number, armario_id: number, quantidade: number) {
    this.insumo_id = insumo_id;
    this.armario_id = armario_id;
    this.quantidade = quantidade;
  }
}
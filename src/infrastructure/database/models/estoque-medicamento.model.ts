import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export interface EstoqueMedicamentoAttributes {
  medicamento_id: number;
  casela_id?: number | null;
  armario_id: number;
  validade?: Date | null;
  quantidade: number;
  origem?: string | null;
  tipo?: string | null;
}

export class EstoqueMedicamentoModel
  extends Model<EstoqueMedicamentoAttributes>
  implements EstoqueMedicamentoAttributes
{
  declare medicamento_id: number;
  declare casela_id: number | null;
  declare armario_id: number;
  declare validade: Date | null;
  declare quantidade: number;
  declare origem: string | null;
  declare tipo: string | null;
}

EstoqueMedicamentoModel.init(
  {
    medicamento_id: { type: DataTypes.INTEGER, allowNull: false },
    casela_id: { type: DataTypes.INTEGER, allowNull: true },
    armario_id: { type: DataTypes.INTEGER, allowNull: false },
    validade: { type: DataTypes.DATEONLY, allowNull: true },
    quantidade: { type: DataTypes.INTEGER, allowNull: false },
    origem: { type: DataTypes.STRING, allowNull: true },
    tipo: { type: DataTypes.STRING, allowNull: true }, // individual / geral
  },
  {
    sequelize,
    tableName: "estoque_medicamento",
    timestamps: false,
  }
);

export default EstoqueMedicamentoModel;

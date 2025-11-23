import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

interface MovimentacaoAttributes {
  id: number;
  tipo: string;
  data: Date;
  login_id: number;
  insumo_id?: number | null;
  medicamento_id?: number | null;
  armario_id: number;
  quantidade: number;
  casela_id?: number | null;
  validade_medicamento?: Date | null;
}

type MovimentacaoCreation = Optional<MovimentacaoAttributes, "id" | "insumo_id" | "medicamento_id" | "casela_id" | "validade_medicamento">;

export class MovimentacaoModel
  extends Model<MovimentacaoAttributes, MovimentacaoCreation>
  implements MovimentacaoAttributes
{
  id!: number;
  tipo!: string;
  data!: Date;
  login_id!: number;
  insumo_id!: number | null;
  medicamento_id!: number | null;
  armario_id!: number;
  quantidade!: number;
  casela_id!: number | null;
  validade_medicamento!: Date | null;
}

MovimentacaoModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tipo: { type: DataTypes.STRING, allowNull: false },
    data: { type: DataTypes.DATE, allowNull: false },
    login_id: { type: DataTypes.INTEGER, allowNull: false },
    insumo_id: { type: DataTypes.INTEGER, allowNull: true },
    medicamento_id: { type: DataTypes.INTEGER, allowNull: true },
    armario_id: { type: DataTypes.INTEGER, allowNull: false },
    quantidade: { type: DataTypes.INTEGER, allowNull: false },
    casela_id: { type: DataTypes.INTEGER, allowNull: true },
    validade_medicamento: { type: DataTypes.DATEONLY, allowNull: true },
  },
  {
    sequelize,
    tableName: "movimentacao",
    timestamps: false,
  }
);

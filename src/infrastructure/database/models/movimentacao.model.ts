import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

interface MovementAttrs {
  id: number;
  tipo: string;
  data: Date;
  login_id: number;
  insumo_id?: number | null;
  medicamento_id?: number | null;
  armario_id: number;
  quantidade: number;
  casela_id?: number | null;
}

type MovementCreation = Optional<MovementAttrs, "id" | "insumo_id" | "medicamento_id" | "casela_id">;

export class MovementModel
  extends Model<MovementAttrs, MovementCreation>
  implements MovementAttrs
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
}

MovementModel.init(
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
  },
  {
    sequelize,
    tableName: "movimentacao",
    timestamps: true,
  }
);

export default MovementModel;
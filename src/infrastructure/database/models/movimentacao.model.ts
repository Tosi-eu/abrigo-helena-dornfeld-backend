import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

interface MovementAttrs {
  id: number;
  tipo: string;
  data: Date;
  login_id: number;
  insumo_id?: number | null;
  gaveta_id?: number | null;
  medicamento_id?: number | null;
  armario_id: number;
  quantidade: number;
  casela_id?: number | null;
}

type MovementCreation = Optional<
  MovementAttrs,
  | 'id'
  | 'insumo_id'
  | 'medicamento_id'
  | 'casela_id'
  | 'gaveta_id'
  | 'armario_id'
>;

export class MovementModel
  extends Model<MovementAttrs, MovementCreation>
  implements MovementAttrs
{
  declare id: number;
  declare tipo: string;
  declare data: Date;
  declare login_id: number;
  declare insumo_id: number | null;
  declare medicamento_id: number | null;
  declare armario_id: number;
  declare quantidade: number;
  declare casela_id: number | null;
  declare gaveta_id: number | null;
}

MovementModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tipo: { type: DataTypes.STRING, allowNull: false },
    data: { type: DataTypes.DATE, allowNull: false },
    login_id: { type: DataTypes.INTEGER, allowNull: false },
    insumo_id: { type: DataTypes.INTEGER, allowNull: true },
    medicamento_id: { type: DataTypes.INTEGER, allowNull: true },
    armario_id: { type: DataTypes.INTEGER, allowNull: true },
    gaveta_id: { type: DataTypes.INTEGER, allowNull: true },
    quantidade: { type: DataTypes.INTEGER, allowNull: false },
    casela_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    tableName: 'movimentacao',
    timestamps: true,
  },
);

export default MovementModel;

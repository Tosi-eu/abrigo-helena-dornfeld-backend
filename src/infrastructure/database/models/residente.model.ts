import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

export interface ResidentAttributes {
  id: number;
  num_casela: number;
  nome: string;
  tenant_id: number;
}

export type ResidentCreationAttributes = Optional<ResidentAttributes, 'id'>;

export class ResidentModel
  extends Model<ResidentAttributes, ResidentCreationAttributes>
  implements ResidentAttributes
{
  declare id: number;
  declare num_casela: number;
  declare nome: string;
  declare tenant_id: number;
}

ResidentModel.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
      field: 'id',
    },
    num_casela: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'num_casela',
    },
    nome: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'nome',
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    sequelize,
    tableName: 'residente',
    timestamps: false,
  },
);

export default ResidentModel;

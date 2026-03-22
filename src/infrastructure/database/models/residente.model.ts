import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

export interface ResidentAttributes {
  num_casela: number;
  nome: string;
  tenant_id: number;
}

export type ResidentCreationAttributes = Optional<
  ResidentAttributes,
  'num_casela'
>;

export class ResidentModel
  extends Model<ResidentAttributes, ResidentCreationAttributes>
  implements ResidentAttributes
{
  declare num_casela: number;
  declare nome: string;
  declare tenant_id: number;
}

ResidentModel.init(
  {
    num_casela: {
      type: DataTypes.INTEGER,
      primaryKey: true,
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

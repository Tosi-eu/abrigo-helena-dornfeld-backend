import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';
import CabinetCategoryModel from './categorias-armario.model';

export interface CabinetAttributes {
  id: number;
  num_armario: number;
  categoria_id: number;
  tenant_id: number;
}

export type CabinetCreationAttributes = Optional<CabinetAttributes, 'id'>;

export class CabinetModel
  extends Model<CabinetAttributes, CabinetCreationAttributes>
  implements CabinetAttributes
{
  declare id: number;
  declare num_armario: number;
  declare categoria_id: number;
  declare tenant_id: number;
  declare CabinetCategoryModel?: CabinetCategoryModel;
}

CabinetModel.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    num_armario: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    categoria_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'categoria_armario',
        key: 'id',
      },
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    sequelize,
    tableName: 'armario',
    timestamps: true,
    indexes: [{ fields: ['categoria_id'], name: 'idx_armario_categoria_id' }],
  },
);

export default CabinetModel;

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

export interface CabinetCategoryAttributes {
  id: number;
  nome: string;
  tenant_id: number;
}

export type CabinetCategoryCreationAttributes = Optional<
  CabinetCategoryAttributes,
  'id'
>;

export class CabinetCategoryModel
  extends Model<CabinetCategoryAttributes, CabinetCategoryCreationAttributes>
  implements CabinetCategoryAttributes
{
  declare id: number;
  declare nome: string;
  declare tenant_id: number;
}

CabinetCategoryModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nome: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    sequelize,
    tableName: 'categoria_armario',
    timestamps: true,
  },
);

export default CabinetCategoryModel;

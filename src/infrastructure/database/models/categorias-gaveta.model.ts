import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

export interface DrawerCategoryAttributes {
  id: number;
  nome: string;
  tenant_id: number;
}

export type DrawerCategoryCreationAttributes = Optional<
  DrawerCategoryAttributes,
  'id'
>;

export class DrawerCategoryModel
  extends Model<DrawerCategoryAttributes, DrawerCategoryCreationAttributes>
  implements DrawerCategoryAttributes
{
  declare id: number;
  declare nome: string;
  declare tenant_id: number;
}

DrawerCategoryModel.init(
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
    tableName: 'categoria_gaveta',
    timestamps: true,
  },
);

export default DrawerCategoryModel;

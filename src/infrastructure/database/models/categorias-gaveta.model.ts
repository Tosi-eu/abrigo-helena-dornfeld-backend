import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

export interface DrawerCategoryAttributes {
  id: number;
  nome: string;
}

export interface DrawerCategoryCreationAttributes extends Optional<
  DrawerCategoryAttributes,
  'id'
> {}

export class DrawerCategoryModel
  extends Model<DrawerCategoryAttributes, DrawerCategoryCreationAttributes>
  implements DrawerCategoryAttributes
{
  declare id: number;
  declare nome: string;
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
  },
  {
    sequelize,
    tableName: 'categoria_gaveta',
    timestamps: true,
  },
);

export default DrawerCategoryModel;

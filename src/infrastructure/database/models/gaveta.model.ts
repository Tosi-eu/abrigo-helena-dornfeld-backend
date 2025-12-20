import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

export interface DrawerAttributes {
  num_gaveta: number;
  categoria_id: number;
}

export interface DrawerCreationAttributes extends Optional<
  DrawerAttributes,
  'num_gaveta'
> {}

export class DrawerModel
  extends Model<DrawerAttributes, DrawerCreationAttributes>
  implements DrawerAttributes
{
  declare num_gaveta: number;
  declare categoria_id: number;

  DrawerCategoryModel: any;
}

DrawerModel.init(
  {
    num_gaveta: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    categoria_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'categoria_gaveta',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'gaveta',
    timestamps: true,
  },
);

export default DrawerModel;

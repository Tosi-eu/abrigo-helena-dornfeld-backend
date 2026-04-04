import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';
import DrawerCategoryModel from './categorias-gaveta.model';

export interface DrawerAttributes {
  id: number;
  num_gaveta: number;
  categoria_id: number;
  tenant_id: number;
}

export type DrawerCreationAttributes = Optional<DrawerAttributes, 'id'>;

export class DrawerModel
  extends Model<DrawerAttributes, DrawerCreationAttributes>
  implements DrawerAttributes
{
  declare id: number;
  declare num_gaveta: number;
  declare categoria_id: number;
  declare tenant_id: number;
  declare DrawerCategoryModel?: DrawerCategoryModel;
}

DrawerModel.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    num_gaveta: {
      type: DataTypes.INTEGER,
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
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    sequelize,
    tableName: 'gaveta',
    timestamps: true,
    indexes: [{ fields: ['categoria_id'], name: 'idx_gaveta_categoria_id' }],
  },
);

export default DrawerModel;

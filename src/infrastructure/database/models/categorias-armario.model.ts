import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

export interface CabinetCategoryAttributes {
  id: number;
  nome: string;
}

export interface CabinetCategoryCreationAttributes extends Optional<
  CabinetCategoryAttributes,
  'id'
> {}

export class CabinetCategoryModel
  extends Model<CabinetCategoryAttributes, CabinetCategoryCreationAttributes>
  implements CabinetCategoryAttributes
{
  declare id: number;
  declare nome: string;
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
  },
  {
    sequelize,
    tableName: 'categoria_armario',
    timestamps: true,
  },
);

export default CabinetCategoryModel;

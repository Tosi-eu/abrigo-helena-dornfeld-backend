import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

export interface InputAttrs {
  id: number;
  nome: string;
  descricao?: string | null;
  estoque_minimo?: number;
}

export interface InsumoCreationAttributes extends Optional<InputAttrs, 'id'> {}

export class InputModel
  extends Model<InputAttrs, InsumoCreationAttributes>
  implements InputAttrs
{
  declare id: number;
  declare nome: string;
  declare descricao?: string | null;
  declare estoque_minimo?: number;
}

InputModel.init(
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
    descricao: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    estoque_minimo: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'insumo',
    timestamps: true,
  },
);

export default InputModel;

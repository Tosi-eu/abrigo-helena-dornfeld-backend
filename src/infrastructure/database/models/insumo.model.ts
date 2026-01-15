import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

export interface InputAttrs {
  id: number;
  nome: string;
  descricao?: string | null;
  estoque_minimo?: number;
  preco?: number | null;
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
  declare preco?: number | null;
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
    preco: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'insumo',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['nome'],
        name: 'uniq_insumo_nome',
      },
    ],
  },
);

export default InputModel;

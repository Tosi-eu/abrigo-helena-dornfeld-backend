import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../sequelize';

export interface InputStockAttributes {
  id?: number;
  insumo_id: number;
  armario_id?: number | null;
  gaveta_id?: number | null;
  quantidade: number;
  validade: Date;
  tipo: string;
}

export class InputStockModel
  extends Model<InputStockAttributes>
  implements InputStockAttributes
{
  declare id: number;
  declare insumo_id: number;
  declare armario_id?: number | null;
  declare gaveta_id?: number | null;
  declare quantidade: number;
  declare validade: Date;
  declare tipo: string;
}

InputStockModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    insumo_id: { type: DataTypes.INTEGER, allowNull: false },

    armario_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    gaveta_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    quantidade: { type: DataTypes.INTEGER, allowNull: false },
    validade: { type: DataTypes.DATE, allowNull: false },
    tipo: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    sequelize,
    tableName: 'estoque_insumo',
    timestamps: false,
  },
);

export default InputStockModel;

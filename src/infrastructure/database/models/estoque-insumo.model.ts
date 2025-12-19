import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../sequelize';

export interface InputStockAttributes {
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
  declare insumo_id: number;
  declare armario_id?: number | null;
  declare gaveta_id?: number | null;
  declare quantidade: number;
  declare validade: Date;
  declare tipo: string;
}

InputStockModel.init(
  {
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

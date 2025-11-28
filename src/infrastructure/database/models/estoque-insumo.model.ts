import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export interface InputStockAttributes {
  insumo_id: number;
  armario_id: number;
  quantidade: number;
}

export class InputStockModel
  extends Model<InputStockAttributes>
  implements InputStockAttributes
{
  declare insumo_id: number;
  declare armario_id: number;
  declare quantidade: number;
}

InputStockModel.init(
  {
    insumo_id: { type: DataTypes.INTEGER, allowNull: false },
    armario_id: { type: DataTypes.INTEGER, allowNull: false },
    quantidade: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    tableName: "estoque_insumo",
    timestamps: false,
  }
);

export default InputStockModel;

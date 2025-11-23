import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export interface EstoqueInsumoAttributes {
  insumo_id: number;
  armario_id: number;
  quantidade: number;
}

export class EstoqueInsumoModel
  extends Model<EstoqueInsumoAttributes>
  implements EstoqueInsumoAttributes
{
  declare insumo_id: number;
  declare armario_id: number;
  declare quantidade: number;
}

EstoqueInsumoModel.init(
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

export default EstoqueInsumoModel;

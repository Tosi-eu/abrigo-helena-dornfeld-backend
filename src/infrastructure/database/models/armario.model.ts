import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface CabinetAttributes {
  num_armario: number;
  categoria: string;
}

export interface CabinetCreationAttributes
  extends Optional<CabinetAttributes, "num_armario"> {}

export class CabinetModel
  extends Model<CabinetAttributes, CabinetCreationAttributes>
  implements CabinetAttributes
{
  declare num_armario: number;
  declare categoria: string;
}
CabinetModel.init(
  {
    num_armario: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      field: "num_armario",
    },
    categoria: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "categoria",
    },
  },
  {
    sequelize,
    tableName: "armario",
    timestamps: false,
  }
);

export default CabinetModel;

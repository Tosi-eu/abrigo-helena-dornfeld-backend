import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface CabinetAttributes {
  num_armario: number;
  categoria_id: number;
}

export interface CabinetCreationAttributes
  extends Optional<CabinetAttributes, "num_armario"> {}

export class CabinetModel
  extends Model<CabinetAttributes, CabinetCreationAttributes>
  implements CabinetAttributes
{
  declare num_armario: number;
  declare categoria_id: number;
  CabinetCategoryModel: any;
}

CabinetModel.init(
  {
    num_armario: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
    },
    categoria_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "categoria_armario",
        key: "id",
      },
    },
  },
  {
    sequelize,
    tableName: "armario",
    timestamps: true,
  }
);

export default CabinetModel;
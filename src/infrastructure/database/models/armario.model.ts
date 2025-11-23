import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface ArmarioAttributes {
  num_armario: number;
  categoria: string;
}

export interface RemanejamentoDTO {
  destinoMedicamentos: number; 
  destinoInsumos: number;     
} 

export interface ArmarioCreationAttributes
  extends Optional<ArmarioAttributes, "num_armario"> {}

export class ArmarioModel
  extends Model<ArmarioAttributes, ArmarioCreationAttributes>
  implements ArmarioAttributes
{
  declare num_armario: number;
  declare categoria: string;
}
ArmarioModel.init(
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

export default ArmarioModel;

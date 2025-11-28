import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

  export interface ResidentAttributes {
    num_casela: number;
    nome: string;
  }

  export interface ResidentCreationAttributes
    extends Optional<ResidentAttributes, "num_casela"> {}

  export class ResidentModel
    extends Model<ResidentAttributes, ResidentCreationAttributes>
    implements ResidentAttributes
  {
    declare num_casela: number;
    declare nome: string;
  }

  ResidentModel.init(
    {
      num_casela: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        field: "num_casela",
      },
      nome: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "nome",
      },
    },
    {
      sequelize,
      tableName: "resident",
      timestamps: false,
    }
  );

  export default ResidentModel;

import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

  export interface ResidenteAttributes {
    num_casela: number;
    nome: string;
  }

  export interface ResidenteCreationAttributes
    extends Optional<ResidenteAttributes, "num_casela"> {}

  export class ResidenteModel
    extends Model<ResidenteAttributes, ResidenteCreationAttributes>
    implements ResidenteAttributes
  {
    declare num_casela: number;
    declare nome: string;
  }

  ResidenteModel.init(
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
      tableName: "residente",
      timestamps: false,
    }
  );

  export default ResidenteModel;

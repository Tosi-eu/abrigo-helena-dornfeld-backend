import { DataTypes, Model } from "sequelize";
import { sequelize } from "../sequelize";

export class LoginModel extends Model {
  declare id: number;
  declare login: string;
  declare password: string;
}

LoginModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    login: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "login",
    timestamps: true,
  },
);

export default LoginModel;

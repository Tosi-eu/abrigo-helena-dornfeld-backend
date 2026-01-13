import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../sequelize';

export class LoginModel extends Model {
  declare id: number;
  declare login: string;
  declare password: string;
  declare refresh_token?: string | null;
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
    refresh_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'login',
    timestamps: true,
    indexes: [
      { fields: ['refresh_token'], name: 'idx_login_refresh_token' },
    ],
  },
);

export default LoginModel;

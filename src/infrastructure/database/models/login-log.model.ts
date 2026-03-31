import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../sequelize';

export class LoginLogModel extends Model {
  declare id: number;
  declare user_id: number | null;
  declare tenant_id?: number | null;
  declare login: string;
  declare success: boolean;
  declare ip: string | null;
  declare user_agent: string | null;
  declare created_at: Date;
}

LoginLogModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    login: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    success: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'login_log',
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
  },
);

export default LoginLogModel;

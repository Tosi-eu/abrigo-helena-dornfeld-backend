import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../sequelize';

export interface UserPermissions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export class LoginModel extends Model {
  declare id: number;
  declare first_name: string;
  declare last_name: string;
  declare login: string;
  declare password: string;
  declare refresh_token?: string | null;
  declare tenant_id: number;
  declare role: 'admin' | 'user';
  declare permissions?: UserPermissions | null;
  declare is_super_admin: boolean;
}

LoginModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    first_name: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    login: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    refresh_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'user',
    },
    permissions: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    is_super_admin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'login',
    timestamps: true,
    indexes: [{ fields: ['refresh_token'], name: 'idx_login_refresh_token' }],
  },
);

export default LoginModel;

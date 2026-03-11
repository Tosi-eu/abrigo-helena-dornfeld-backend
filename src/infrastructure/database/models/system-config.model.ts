import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../sequelize';

export class SystemConfigModel extends Model {
  declare id: number;
  declare key: string;
  declare value: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

SystemConfigModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'system_config',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default SystemConfigModel;

import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../sequelize';

export type AuditOperationType = 'create' | 'update' | 'delete';

export class AuditLogModel extends Model {
  declare id: number;
  declare user_id: number | null;
  declare method: string;
  declare path: string;
  declare operation_type: AuditOperationType;
  declare resource: string | null;
  declare status_code: number;
  declare duration_ms: number | null;
  declare created_at: Date;
}

AuditLogModel.init(
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
    method: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    path: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    operation_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    resource: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    status_code: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    duration_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'audit_log',
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
  },
);

export default AuditLogModel;

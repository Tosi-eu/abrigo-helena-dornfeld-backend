import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

export interface TenantInviteAttrs {
  id: number;
  tenant_id: number;
  token_digest: string;
  expires_at: Date;
  email?: string | null;
  role?: 'admin' | 'user' | null;
  permissions_json?: {
    read?: boolean;
    create?: boolean;
    update?: boolean;
    delete?: boolean;
  } | null;
  created_by_user_id?: number | null;
  used_at?: Date | null;
  revoked_at?: Date | null;
}

type Creation = Optional<TenantInviteAttrs, 'id'>;

export class TenantInviteModel extends Model<TenantInviteAttrs, Creation> {
  declare id: number;
  declare tenant_id: number;
  declare token_digest: string;
  declare expires_at: Date;
  declare email: string | null;
  declare role: 'admin' | 'user' | null;
  declare permissions_json: {
    read?: boolean;
    create?: boolean;
    update?: boolean;
    delete?: boolean;
  } | null;
  declare created_by_user_id: number | null;
  declare used_at: Date | null;
  declare revoked_at: Date | null;
}

TenantInviteModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    token_digest: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: true },
    role: { type: DataTypes.STRING(20), allowNull: true },
    permissions_json: { type: DataTypes.JSONB, allowNull: true },
    created_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
    used_at: { type: DataTypes.DATE, allowNull: true },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'tenant_invite',
    timestamps: true,
    underscored: true,
  },
);

export default TenantInviteModel;

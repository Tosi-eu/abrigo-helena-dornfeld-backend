import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

export interface TenantConfigAttrs {
  id: number;
  tenant_id: number;
  modules_json: object;
}

type TenantConfigCreation = Optional<TenantConfigAttrs, 'id'>;

export class TenantConfigModel extends Model<
  TenantConfigAttrs,
  TenantConfigCreation
> {
  declare id: number;
  declare tenant_id: number;
  declare modules_json: object;
}

TenantConfigModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    modules_json: { type: DataTypes.JSONB, allowNull: false },
  },
  {
    sequelize,
    tableName: 'tenant_config',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default TenantConfigModel;

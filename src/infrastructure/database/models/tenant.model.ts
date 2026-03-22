import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

export interface TenantAttrs {
  id: number;
  slug: string;
  name: string;
  brand_name?: string | null;
  logo_data_url?: string | null;
  contract_code_hash?: string | null;
}

type TenantCreation = Optional<TenantAttrs, 'id'>;

export class TenantModel extends Model<TenantAttrs, TenantCreation> {
  declare id: number;
  declare slug: string;
  declare name: string;
  declare brand_name?: string | null;
  declare logo_data_url?: string | null;
  declare contract_code_hash?: string | null;
}

TenantModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    slug: { type: DataTypes.STRING(60), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    brand_name: { type: DataTypes.STRING(160), allowNull: true },
    logo_data_url: { type: DataTypes.TEXT, allowNull: true },
    contract_code_hash: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    sequelize,
    tableName: 'tenant',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default TenantModel;

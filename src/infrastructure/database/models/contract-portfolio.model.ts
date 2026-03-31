import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

export interface ContractPortfolioAttrs {
  id: number;
  contract_code_hash: string;
}

type Creation = Optional<ContractPortfolioAttrs, 'id'>;

export class ContractPortfolioModel extends Model<
  ContractPortfolioAttrs,
  Creation
> {
  declare id: number;
  declare contract_code_hash: string;
}

ContractPortfolioModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    contract_code_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'contract_portfolio',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
);

export default ContractPortfolioModel;

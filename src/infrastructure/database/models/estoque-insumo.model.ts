import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../sequelize';
import { StockItemStatus } from '../../../core/utils/utils';

export interface InputStockAttributes {
  id?: number;
  insumo_id: number;
  casela_id?: number | null;
  armario_id?: number | null;
  gaveta_id?: number | null;
  quantidade: number;
  validade: Date;
  tipo: string;
  setor: string;
  lote?: string | null;
  status?: StockItemStatus;
  suspended_at?: Date | null;
  preco?: number | null;
}

export class InputStockModel
  extends Model<InputStockAttributes>
  implements InputStockAttributes
{
  declare id?: number;
  declare insumo_id: number;
  declare casela_id?: number | null;
  declare armario_id?: number | null;
  declare gaveta_id?: number | null;
  declare quantidade: number;
  declare validade: Date;
  declare tipo: string;
  declare setor: string;
  declare lote?: string | null;
  declare status: StockItemStatus;
  declare suspended_at?: Date | null;
  declare preco?: number | null;
}

InputStockModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    insumo_id: { type: DataTypes.INTEGER, allowNull: false },

    casela_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    armario_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    gaveta_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    quantidade: { type: DataTypes.INTEGER, allowNull: false },
    validade: { type: DataTypes.DATE, allowNull: false },
    tipo: { type: DataTypes.TEXT, allowNull: false },
    setor: { type: DataTypes.TEXT, allowNull: false },
    lote: { type: DataTypes.STRING, allowNull: true },
    status: {
      type: DataTypes.ENUM(...Object.values(StockItemStatus)),
      allowNull: false,
      defaultValue: StockItemStatus.ATIVO,
    },
    suspended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    preco: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'estoque_insumo',
    timestamps: true,
    indexes: [
      { fields: ['insumo_id'], name: 'idx_estoque_insumo_insumo_id' },
      { fields: ['armario_id'], name: 'idx_estoque_insumo_armario_id' },
      { fields: ['gaveta_id'], name: 'idx_estoque_insumo_gaveta_id' },
      { fields: ['casela_id'], name: 'idx_estoque_insumo_casela_id' },
      { fields: ['status'], name: 'idx_estoque_insumo_status' },
      { fields: ['tipo'], name: 'idx_estoque_insumo_tipo' },
      { fields: ['setor'], name: 'idx_estoque_insumo_setor' },
      { fields: ['validade'], name: 'idx_estoque_insumo_validade' },
      {
        fields: ['tipo', 'setor'],
        name: 'idx_estoque_insumo_tipo_setor',
      },
      {
        fields: [
          'insumo_id',
          'armario_id',
          'gaveta_id',
          'validade',
          'tipo',
          'casela_id',
          'lote',
        ],
        name: 'idx_estoque_insumo_composite_lookup',
      },
    ],
  },
);

export default InputStockModel;

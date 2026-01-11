import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../sequelize';
import { StockItemStatus } from '../../../core/utils/utils';

export interface MedicineStockAttributes {
  id?: number;
  medicamento_id: number;
  casela_id?: number | null;
  armario_id?: number | null;
  gaveta_id?: number | null;
  validade?: Date | null;
  quantidade: number;
  origem?: string | null;
  tipo?: string | null;
  setor: string;
  lote?: string | null;
  status?: StockItemStatus;
  suspended_at?: Date | null;
  observacao?: string | null;
  preco?: number | null;
}

export class MedicineStockModel
  extends Model<MedicineStockAttributes>
  implements MedicineStockAttributes
{
  declare id: number;
  declare medicamento_id: number;
  declare casela_id: number | null;
  declare armario_id?: number | null;
  declare gaveta_id?: number | null;
  declare validade: Date | null;
  declare quantidade: number;
  declare origem: string | null;
  declare tipo: string | null;
  declare setor: string;
  declare lote?: string | null;
  declare status: StockItemStatus;
  declare suspended_at?: Date | null;
  declare observacao?: string | null;
  declare preco?: number | null;
}

MedicineStockModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    medicamento_id: { type: DataTypes.INTEGER, allowNull: false },

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

    validade: { type: DataTypes.DATEONLY, allowNull: false },
    quantidade: { type: DataTypes.INTEGER, allowNull: false },
    origem: { type: DataTypes.STRING, allowNull: false },
    tipo: { type: DataTypes.STRING, allowNull: false },
    status: {
      type: DataTypes.ENUM(...Object.values(StockItemStatus)),
      allowNull: false,
      defaultValue: StockItemStatus.ATIVO,
    },
    lote: { type: DataTypes.STRING, allowNull: true },
    setor: { type: DataTypes.TEXT, allowNull: false },
    suspended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    observacao: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    preco: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'estoque_medicamento',
    timestamps: true,
  },
);

export default MedicineStockModel;

import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../sequelize';
import { MedicineStatus } from '../../../core/utils/utils';

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
  status?: MedicineStatus;
  suspended_at?: Date | null;
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
  declare status: MedicineStatus;
  declare suspended_at?: Date | null;
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
      type: DataTypes.ENUM('active', 'suspended'),
      allowNull: false,
      defaultValue: 'active',
    },
    lote: { type: DataTypes.STRING, allowNull: true },
    setor: { type: DataTypes.TEXT, allowNull: false },
    suspended_at: {
      type: DataTypes.DATE,
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

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';

interface MovementAttrs {
  id: number;
  tipo: string;
  data: Date;
  login_id: number;
  insumo_id?: number | null;
  gaveta_id?: number | null;
  medicamento_id?: number | null;
  armario_id: number;
  quantidade: number;
  casela_id?: number | null;
  setor: string;
  destino?: string | null;
  lote?: string | null;
}

type MovementCreation = Optional<
  MovementAttrs,
  | 'id'
  | 'insumo_id'
  | 'medicamento_id'
  | 'casela_id'
  | 'gaveta_id'
  | 'armario_id'
  | 'lote'
  | 'destino'
>;

export class MovementModel
  extends Model<MovementAttrs, MovementCreation>
  implements MovementAttrs
{
  declare id: number;
  declare tipo: string;
  declare data: Date;
  declare login_id: number;
  declare insumo_id: number | null;
  declare medicamento_id: number | null;
  declare armario_id: number;
  declare quantidade: number;
  declare casela_id: number | null;
  declare gaveta_id: number | null;
  declare setor: string;
  declare destino?: string | null;
  declare lote?: string | null;
}

MovementModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tipo: { type: DataTypes.STRING, allowNull: false },
    data: { type: DataTypes.DATE, allowNull: false },
    login_id: { type: DataTypes.INTEGER, allowNull: false },
    insumo_id: { type: DataTypes.INTEGER, allowNull: true },
    medicamento_id: { type: DataTypes.INTEGER, allowNull: true },
    armario_id: { type: DataTypes.INTEGER, allowNull: true },
    gaveta_id: { type: DataTypes.INTEGER, allowNull: true },
    quantidade: { type: DataTypes.INTEGER, allowNull: false },
    casela_id: { type: DataTypes.INTEGER, allowNull: true },
    setor: { type: DataTypes.STRING, allowNull: false },
    lote: { type: DataTypes.STRING, allowNull: true },
    destino: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    tableName: 'movimentacao',
    timestamps: true,
    indexes: [
      { fields: ['medicamento_id'], name: 'idx_movimentacao_medicamento_id' },
      { fields: ['insumo_id'], name: 'idx_movimentacao_insumo_id' },
      { fields: ['armario_id'], name: 'idx_movimentacao_armario_id' },
      { fields: ['gaveta_id'], name: 'idx_movimentacao_gaveta_id' },
      { fields: ['casela_id'], name: 'idx_movimentacao_casela_id' },
      { fields: ['login_id'], name: 'idx_movimentacao_login_id' },
      { fields: ['tipo'], name: 'idx_movimentacao_tipo' },
      { fields: ['setor'], name: 'idx_movimentacao_setor' },
      { fields: ['data'], name: 'idx_movimentacao_data' },
      {
        fields: ['tipo', 'data'],
        name: 'idx_movimentacao_tipo_data',
      },
      {
        fields: ['medicamento_id', 'data'],
        name: 'idx_movimentacao_medicamento_data',
      },
      {
        fields: ['insumo_id', 'data'],
        name: 'idx_movimentacao_insumo_data',
      },
    ],
  },
);

export default MovementModel;

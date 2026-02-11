import CabinetModel from './armario.model';
import CabinetCategoryModel from './categorias-armario.model';
import DrawerCategoryModel from './categorias-gaveta.model';
import StockInputAttrs, { InputStockModel } from './estoque-insumo.model';
import StockMedicineAttrs from './estoque-medicamento.model';
import MedicineStockModel from './estoque-medicamento.model';
import DrawerModel from './gaveta.model';
import InputModel from './insumo.model';
import LoginModel from './login.model';
import MedicineModel from './medicamento.model';
import MovementModel from './movimentacao.model';
import NotificationEventModel from './notificacao.model';
import ResidentModel from './residente.model';

export function setupAssociations() {
  DrawerCategoryModel.hasMany(DrawerModel, { foreignKey: 'categoria_id', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  DrawerModel.belongsTo(DrawerCategoryModel, { foreignKey: 'categoria_id', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  DrawerCategoryModel.hasMany(DrawerModel, { foreignKey: 'categoria_id' });

  CabinetCategoryModel.hasMany(CabinetModel, { foreignKey: 'categoria_id', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  CabinetModel.belongsTo(CabinetCategoryModel, { foreignKey: 'categoria_id', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  CabinetCategoryModel.hasMany(CabinetModel, { foreignKey: 'categoria_id' });

  NotificationEventModel.belongsTo(ResidentModel, { foreignKey: 'residente_id', as: 'residente' });
  NotificationEventModel.belongsTo(MedicineModel, { foreignKey: 'medicamento_id', as: 'medicamento' });
  NotificationEventModel.belongsTo(LoginModel, { foreignKey: 'criado_por', as: 'usuario' });

  CabinetModel.hasMany(StockInputAttrs, { foreignKey: 'armario_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  StockInputAttrs.belongsTo(CabinetModel, { foreignKey: 'armario_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  ResidentModel.hasMany(StockInputAttrs, { foreignKey: 'casela_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  StockInputAttrs.belongsTo(ResidentModel, { foreignKey: 'casela_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  InputModel.hasMany(StockInputAttrs, { foreignKey: 'insumo_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
  StockInputAttrs.belongsTo(InputModel, { foreignKey: 'insumo_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

  CabinetModel.hasMany(StockMedicineAttrs, { foreignKey: 'armario_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  StockMedicineAttrs.belongsTo(CabinetModel, { foreignKey: 'armario_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  ResidentModel.hasMany(StockMedicineAttrs, { foreignKey: 'casela_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  StockMedicineAttrs.belongsTo(ResidentModel, { foreignKey: 'casela_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  MedicineModel.hasMany(StockMedicineAttrs, { foreignKey: 'medicamento_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
  StockMedicineAttrs.belongsTo(MedicineModel, { foreignKey: 'medicamento_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

  CabinetModel.hasMany(MovementModel, { foreignKey: 'armario_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  MovementModel.belongsTo(CabinetModel, { foreignKey: 'armario_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  ResidentModel.hasMany(MovementModel, { foreignKey: 'casela_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  MovementModel.belongsTo(ResidentModel, { foreignKey: 'casela_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  MedicineModel.hasMany(MovementModel, { foreignKey: 'medicamento_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
  MovementModel.belongsTo(MedicineModel, { foreignKey: 'medicamento_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

  InputModel.hasMany(MovementModel, { foreignKey: 'insumo_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
  MovementModel.belongsTo(InputModel, { foreignKey: 'insumo_id', onDelete: 'CASCADE', onUpdate: 'CASCADE' });

  LoginModel.hasMany(MovementModel, { foreignKey: 'login_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  MovementModel.belongsTo(LoginModel, { foreignKey: 'login_id', onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  NotificationEventModel.hasMany(MovementModel, { as: 'movimentacoes', foreignKey: 'medicamento_id', sourceKey: 'medicamento_id', constraints: false });
  MovementModel.belongsTo(NotificationEventModel, { foreignKey: 'medicamento_id', targetKey: 'medicamento_id', constraints: false });

  NotificationEventModel.hasOne(StockMedicineAttrs, { as: 'estoque', foreignKey: 'medicamento_id', sourceKey: 'medicamento_id', constraints: false });
  StockMedicineAttrs.belongsTo(NotificationEventModel, { foreignKey: 'medicamento_id', targetKey: 'medicamento_id', constraints: false });

  MedicineStockModel.hasMany(MovementModel, {
    foreignKey: 'medicamento_id',
    sourceKey: 'medicamento_id',
    constraints: false, 
  });
  MovementModel.belongsTo(MedicineStockModel, {
    foreignKey: 'medicamento_id',
    targetKey: 'medicamento_id',
    constraints: false,
  });

  InputStockModel.hasMany(MovementModel, {
    foreignKey: 'insumo_id',
    sourceKey: 'insumo_id',
    constraints: false, 
  });
  MovementModel.belongsTo(InputStockModel, {
    foreignKey: 'insumo_id',
    targetKey: 'insumo_id',
    constraints: false,
  });
}

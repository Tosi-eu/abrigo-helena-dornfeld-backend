import CabinetModel from "./armario.model";
import StockInputAttrs from "./estoque-insumo.model";
import StockMedicineAttrs from "./estoque-medicamento.model";
import InputModel from "./insumo.model";
import LoginModel from "./login.model";
import MedicineModel from "./medicamento.model";
import MovementModel from "./movimentacao.model";
import ResidentModel from "./residente.model";

export function setupAssociations() {
  CabinetModel.hasMany(StockInputAttrs, { foreignKey: "armario_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  StockInputAttrs.belongsTo(CabinetModel, { foreignKey: "armario_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  CabinetModel.hasMany(StockMedicineAttrs, { foreignKey: "armario_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  StockMedicineAttrs.belongsTo(CabinetModel, { foreignKey: "armario_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  CabinetModel.hasMany(MovementModel, { foreignKey: "armario_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  MovementModel.belongsTo(CabinetModel, { foreignKey: "armario_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  ResidentModel.hasMany(StockMedicineAttrs, { foreignKey: "casela_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  StockMedicineAttrs.belongsTo(ResidentModel, { foreignKey: "casela_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  ResidentModel.hasMany(MovementModel, { foreignKey: "casela_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  MovementModel.belongsTo(ResidentModel, { foreignKey: "casela_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  MedicineModel.hasMany(StockMedicineAttrs, { foreignKey: "medicamento_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  StockMedicineAttrs.belongsTo(MedicineModel, { foreignKey: "medicamento_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

  MedicineModel.hasMany(MovementModel, { foreignKey: "medicamento_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  MovementModel.belongsTo(MedicineModel, { foreignKey: "medicamento_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

  InputModel.hasMany(StockInputAttrs, { foreignKey: "insumo_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  StockInputAttrs.belongsTo(InputModel, { foreignKey: "insumo_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

  InputModel.hasMany(MovementModel, { foreignKey: "insumo_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  MovementModel.belongsTo(InputModel, { foreignKey: "insumo_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

  LoginModel.hasMany(MovementModel, { foreignKey: "login_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  MovementModel.belongsTo(LoginModel, { foreignKey: "login_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });
}

import ArmarioModel from "./armario.model";
import EstoqueInsumoModel from "./estoque-insumo.model";
import { EstoqueMedicamentoModel } from "./estoque-medicamento.model";
import { InsumoModel } from "./insumo.model";
import { LoginModel } from "./login.model";
import { MedicamentoModel } from "./medicamento.model";
import { MovimentacaoModel } from "./movimentacao.model";
import { ResidenteModel } from "./residente.model";

export function setupAssociations() {
  ArmarioModel.hasMany(EstoqueInsumoModel, { foreignKey: "armario_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  EstoqueInsumoModel.belongsTo(ArmarioModel, { foreignKey: "armario_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  ArmarioModel.hasMany(EstoqueMedicamentoModel, { foreignKey: "armario_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  EstoqueMedicamentoModel.belongsTo(ArmarioModel, { foreignKey: "armario_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  ArmarioModel.hasMany(MovimentacaoModel, { foreignKey: "armario_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  MovimentacaoModel.belongsTo(ArmarioModel, { foreignKey: "armario_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  ResidenteModel.hasMany(EstoqueMedicamentoModel, { foreignKey: "casela_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  EstoqueMedicamentoModel.belongsTo(ResidenteModel, { foreignKey: "casela_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  ResidenteModel.hasMany(MovimentacaoModel, { foreignKey: "casela_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  MovimentacaoModel.belongsTo(ResidenteModel, { foreignKey: "casela_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });

  MedicamentoModel.hasMany(EstoqueMedicamentoModel, { foreignKey: "medicamento_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  EstoqueMedicamentoModel.belongsTo(MedicamentoModel, { foreignKey: "medicamento_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

  MedicamentoModel.hasMany(MovimentacaoModel, { foreignKey: "medicamento_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  MovimentacaoModel.belongsTo(MedicamentoModel, { foreignKey: "medicamento_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

  InsumoModel.hasMany(EstoqueInsumoModel, { foreignKey: "insumo_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  EstoqueInsumoModel.belongsTo(InsumoModel, { foreignKey: "insumo_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

  InsumoModel.hasMany(MovimentacaoModel, { foreignKey: "insumo_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  MovimentacaoModel.belongsTo(InsumoModel, { foreignKey: "insumo_id", onDelete: 'RESTRICT', onUpdate: 'CASCADE' });

  LoginModel.hasMany(MovimentacaoModel, { foreignKey: "login_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });
  MovimentacaoModel.belongsTo(LoginModel, { foreignKey: "login_id", onDelete: 'SET NULL', onUpdate: 'CASCADE' });
}

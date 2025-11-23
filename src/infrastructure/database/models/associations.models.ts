import ArmarioModel from "./armario.model";
import EstoqueInsumoModel from "./estoque-insumo.model";
import { EstoqueMedicamentoModel } from "./estoque-medicamento.model";
import { InsumoModel } from "./insumo.model";
import { LoginModel } from "./login.model";
import { MedicamentoModel } from "./medicamento.model";
import { MovimentacaoModel } from "./movimentacao.model";
import { ResidenteModel } from "./residente.model";

export function setupAssociations() {
  ArmarioModel.hasMany(EstoqueInsumoModel, { foreignKey: "armario_id" });
  EstoqueInsumoModel.belongsTo(ArmarioModel, { foreignKey: "armario_id" });
  ArmarioModel.hasMany(EstoqueMedicamentoModel, { foreignKey: "armario_id" });
  EstoqueMedicamentoModel.belongsTo(ArmarioModel, { foreignKey: "armario_id" });
  ArmarioModel.hasMany(MovimentacaoModel, { foreignKey: "armario_id" });
  MovimentacaoModel.belongsTo(ArmarioModel, { foreignKey: "armario_id" });
  ResidenteModel.hasMany(EstoqueMedicamentoModel, { foreignKey: "casela_id" });
  EstoqueMedicamentoModel.belongsTo(ResidenteModel, { foreignKey: "casela_id" });
  ResidenteModel.hasMany(MovimentacaoModel, { foreignKey: "casela_id" });
  MovimentacaoModel.belongsTo(ResidenteModel, { foreignKey: "casela_id" });
  MedicamentoModel.hasMany(EstoqueMedicamentoModel, { foreignKey: "medicamento_id" });
  EstoqueMedicamentoModel.belongsTo(MedicamentoModel, { foreignKey: "medicamento_id" });
  MedicamentoModel.hasMany(MovimentacaoModel, { foreignKey: "medicamento_id" });
  MovimentacaoModel.belongsTo(MedicamentoModel, { foreignKey: "medicamento_id" });
  InsumoModel.hasMany(EstoqueInsumoModel, { foreignKey: "insumo_id" });
  EstoqueInsumoModel.belongsTo(InsumoModel, { foreignKey: "insumo_id" });
  InsumoModel.hasMany(MovimentacaoModel, { foreignKey: "insumo_id" });
  MovimentacaoModel.belongsTo(InsumoModel, { foreignKey: "insumo_id" });
  LoginModel.hasMany(MovimentacaoModel, { foreignKey: "login_id" });
  MovimentacaoModel.belongsTo(LoginModel, { foreignKey: "login_id" });
}

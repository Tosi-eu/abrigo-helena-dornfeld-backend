import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface MedicamentoAttributes {
  id: number;
  nome: string;
  dosagem: number;
  unidade_medida: string;
  principio_ativo: string | null;
  estoque_minimo: number;
}

export interface MedicamentoCreationAttributes
  extends Optional<MedicamentoAttributes, "id" | "principio_ativo"> {}

export class MedicamentoModel
  extends Model<MedicamentoAttributes, MedicamentoCreationAttributes>
  implements MedicamentoAttributes
{
  declare id: number;
  declare nome: string;
  declare dosagem: number;
  declare unidade_medida: string;
  declare principio_ativo: string | null;
  declare estoque_minimo: number;
}

MedicamentoModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nome: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    dosagem: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    unidade_medida: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    principio_ativo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    estoque_minimo: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "medicamento",
    timestamps: false,
  }
);

export default MedicamentoModel;

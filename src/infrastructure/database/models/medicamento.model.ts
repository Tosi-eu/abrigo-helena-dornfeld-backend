import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface MedicineAttrs {
  id: number;
  nome: string;
  dosagem: number;
  unidade_medida: string;
  principio_ativo: string;
  estoque_minimo: number;
}

export interface MedicineCreationAttrs
  extends Optional<MedicineAttrs, "id" | "estoque_minimo"> {}

export class MedicineModel
  extends Model<MedicineAttrs, MedicineCreationAttrs>
  implements MedicineAttrs
{
  declare id: number;
  declare nome: string;
  declare dosagem: number;
  declare unidade_medida: string;
  declare principio_ativo: string;
  declare estoque_minimo: number;
}

MedicineModel.init(
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
      allowNull: false,
    },
    estoque_minimo: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "medicamento",
    timestamps: true,
  }
);

export default MedicineModel;

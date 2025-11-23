import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../sequelize";

export interface InsumoAttributes {
  id: number;
  nome: string;
  descricao?: string | null;
}

export interface InsumoCreationAttributes extends Optional<InsumoAttributes, "id"> {}

export class InsumoModel
  extends Model<InsumoAttributes, InsumoCreationAttributes>
  implements InsumoAttributes
{
  declare id: number;
  declare nome: string;
  declare descricao: string | null;
}

InsumoModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nome: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    descricao: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "insumo",
    timestamps: false,
  }
);

export default InsumoModel;

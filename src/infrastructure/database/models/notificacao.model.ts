import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';
import ResidentModel from './residente.model';
import MedicineModel from './medicamento.model';
import LoginModel from './login.model';

interface NotificationEventAttrs {
  id: number;
  medicamento_id: number;
  residente_id: number;
  destino: 'SUS' | 'Família';
  data_prevista: Date;
  criado_por: number;
  status: EventStatus;
  visto: boolean;
}

type NotificationEventCreation = Optional<
  NotificationEventAttrs,
  'id' | 'status'
>;

enum EventStatus {
  PENDENTE = 'pending',
  ENVIADO = 'sent',
  CANCELADO = 'cancelled',
}

export class NotificationEventModel
  extends Model<NotificationEventAttrs, NotificationEventCreation>
  implements NotificationEventAttrs
{
  declare id: number;
  declare medicamento_id: number;
  declare residente_id: number;
  declare destino: 'SUS' | 'Família';
  declare data_prevista: Date;
  declare criado_por: number;
  declare status: EventStatus;
  declare residente?: ResidentModel;
  declare medicamento?: MedicineModel;
  declare usuario?: Omit<LoginModel, 'password'>;
  declare visto: boolean;
}

NotificationEventModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    medicamento_id: { type: DataTypes.INTEGER, allowNull: false },
    residente_id: { type: DataTypes.INTEGER, allowNull: false },

    destino: {
      type: DataTypes.ENUM('SUS', 'Família'),
      allowNull: false,
    },

    data_prevista: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    criado_por: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...Object.values(EventStatus)),
      allowNull: false,
      defaultValue: EventStatus.PENDENTE,
    },
    visto: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'notificacao',
    timestamps: true,
  },
);

export default NotificationEventModel;

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../sequelize';
import ResidentModel from './residente.model';
import MedicineModel from './medicamento.model';
import LoginModel from './login.model';

export enum NotificationDestinoType {
  SUS = 'sus',
  FAMILIA = 'familia',
  FARMACIA = 'farmacia',
  ESTOQUE = 'estoque'
}

export enum EventStatus {
  PENDENTE = 'pending',
  ENVIADO = 'sent',
  CANCELADO = 'cancelled',
}

export enum NotificationEventType {
  MEDICAMENTO = 'medicamento',
  REPOSICAO_ESTOQUE = 'reposicao_estoque',
}

export type NotificationItemType = 'medicamento' | 'insumo';

interface NotificationEventAttrs {
  id: number;

  tipo_evento: NotificationEventType;

  medicamento_id?: number | null;
  residente_id?: number | null;

  destino: NotificationDestinoType;

  data_prevista?: Date | null;

  criado_por: number;
  status: EventStatus;
  visto: boolean;
}

type NotificationEventCreation = Optional<
  NotificationEventAttrs,
  'id' | 'status' | 'visto' | 'data_prevista'
>;

export class NotificationEventModel
  extends Model<NotificationEventAttrs, NotificationEventCreation>
  implements NotificationEventAttrs
{
  declare id: number;

  declare tipo_evento: NotificationEventType;

  declare medicamento_id?: number | null;
  declare residente_id?: number | null;

  declare destino: NotificationDestinoType;

  declare data_prevista?: Date | null;

  declare criado_por: number;
  declare status: EventStatus;
  declare visto: boolean;

  declare residente?: ResidentModel;
  declare medicamento?: MedicineModel;
  declare usuario?: Omit<LoginModel, 'password'>;
}

NotificationEventModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    tipo_evento: {
      type: DataTypes.ENUM(...Object.values(NotificationEventType)),
      allowNull: false,
    },

    medicamento_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    residente_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    destino: {
      type: DataTypes.ENUM(...Object.values(NotificationDestinoType)),
      allowNull: false,
    },

    data_prevista: {
      type: DataTypes.DATEONLY,
      allowNull: true,
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
    indexes: [
      { fields: ['tipo_evento'], name: 'idx_notificacao_tipo_evento' },
      { fields: ['medicamento_id'], name: 'idx_notificacao_medicamento_id' },
      { fields: ['residente_id'], name: 'idx_notificacao_residente_id' },
      { fields: ['criado_por'], name: 'idx_notificacao_criado_por' },
      { fields: ['status'], name: 'idx_notificacao_status' },
      { fields: ['visto'], name: 'idx_notificacao_visto' },
    ],
  },
);

export default NotificationEventModel;
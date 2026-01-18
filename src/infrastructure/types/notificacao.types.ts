import {
  EventStatus,
  NotificationDestinoType,
} from '../database/models/notificacao.model';

export interface NotificationUpdateData {
  status?: EventStatus;
  visto?: boolean;
  data_prevista?: Date;
  destino?: NotificationDestinoType;
}

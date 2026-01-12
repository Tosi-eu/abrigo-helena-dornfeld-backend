import { NotificationDestinoType } from '../database/models/notificacao.model';
import { EventStatus } from '../database/models/notificacao.model';

export interface NotificationUpdateData {
  status?: 'pending' | 'completed' | 'cancelled';
  visto?: boolean;
  data_prevista?: Date;
  destino?: NotificationDestinoType;
}

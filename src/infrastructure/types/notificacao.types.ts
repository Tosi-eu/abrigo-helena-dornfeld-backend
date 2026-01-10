export interface NotificationUpdateData {
  status?: 'pending' | 'completed' | 'cancelled';
  visto?: boolean;
  data_prevista?: Date;
  destino?: 'sus' | 'familia' | 'farmacia';
}

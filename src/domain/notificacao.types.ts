export enum NotificationDestinoType {
  SUS = 'sus',
  FAMILIA = 'familia',
  FARMACIA = 'farmacia',
  ESTOQUE = 'estoque',
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

export interface NotificationUpdateData {
  status?: EventStatus;
  visto?: boolean;
  data_prevista?: Date;
  destino?: NotificationDestinoType;
}

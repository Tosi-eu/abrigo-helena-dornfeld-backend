import { WhereOptions } from 'sequelize';
import { Op } from 'sequelize';

export type MovementWhereOptions = WhereOptions & {
  medicamento_id?: { [Op.not]: null } | number;
  insumo_id?: { [Op.not]: null } | number;
  tipo?: string;
  data?:
    | { [Op.gte]: Date }
    | { [Op.lte]: Date }
    | { [Op.between]: [Date, Date] };
};

export type NotificationWhereOptions = WhereOptions & {
  status?: string;
};

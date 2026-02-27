import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import type { RlsContextVars } from '../infrastructure/database/rls.context';
import type { Transaction } from 'sequelize';
import type { Sequelize } from 'sequelize';
import { withRlsContext } from '../infrastructure/database/rls.context';

export interface RlsRequest extends AuthRequest {
  rlsContext?: RlsContextVars;
  transaction?: Transaction;
}

export function rlsContextMiddleware(
  req: RlsRequest,
  _res: Response,
  next: NextFunction,
) {
  if (req.user?.id != null) {
    req.rlsContext = { current_user_id: req.user.id };
  } else {
    req.rlsContext = {};
  }
  next();
}

type RouteHandler = (
  req: RlsRequest,
  res: Response,
  next?: NextFunction,
) => void | Promise<unknown>;

export function withRls(sequelize: Sequelize, handler: RouteHandler) {
  return (req: RlsRequest, res: Response, next: NextFunction) => {
    const context = req.rlsContext ?? {};
    withRlsContext(sequelize, context, async transaction => {
      (req as RlsRequest).transaction = transaction;
      try {
        await handler(req, res, next);
      } catch (err) {
        next(err);
      }
    }).catch(next);
  };
}

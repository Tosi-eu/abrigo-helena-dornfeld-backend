import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../infrastructure/helpers/auth.helper';
import LoginModel from '../infrastructure/database/models/login.model';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    login: string;
  };
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ error: 'Token não fornecido' });

  const [, token] = authHeader.split(' ');
  if (!token) return res.status(401).json({ error: 'Token inválido' });

  try {
    const decoded = jwt.verify(token, jwtConfig.secret) as any;

    LoginModel.findOne({ where: { refreshToken: token } }).then(user => {
      if (!user) return res.status(401).json({ error: 'Sessão inválida' });

      req.user = {
        id: Number(decoded.sub),
        login: decoded.login,
      };

      next();
    });
  } catch {
    return res.status(401).json({ error: 'Token expirado ou inválido' });
  }
}

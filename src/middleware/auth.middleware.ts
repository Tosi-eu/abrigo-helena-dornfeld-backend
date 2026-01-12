import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { jwtConfig } from '../infrastructure/helpers/auth.helper';
import LoginModel from '../infrastructure/database/models/login.model';
import { JWTPayload } from '../infrastructure/types/jwt.types';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    login: string;
  };
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  let token: string | undefined;

  if (req.cookies && req.cookies.authToken) {
    token = req.cookies.authToken;
  } else {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const [, headerToken] = authHeader.split(' ');
      if (headerToken) {
        token = headerToken;
      }
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.secret) as JWTPayload;

    const user = await LoginModel.findOne({ where: { refresh_token: token } });
    if (!user) return res.status(401).json({ error: 'Sessão inválida' });

    req.user = {
      id: Number(decoded.sub),
      login: decoded.login,
    };

    next();
  } catch {
    return res.status(401).json({ error: 'Token expirado ou inválido' });
  }
}

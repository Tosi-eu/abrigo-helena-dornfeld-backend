import { SignOptions } from 'jsonwebtoken';
import { tryGetSystemConfigRuntime } from '@config/system-config-runtime';
import { getBuiltinDefaultSystemConfig } from '@services/system-config.defaults';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. Please set it in your .env file.',
  );
}

export function getJwtExpiresIn(): SignOptions['expiresIn'] {
  const fromSvc = tryGetSystemConfigRuntime()?.get().ttl.jwtExpiresIn;
  const v = (
    fromSvc ?? getBuiltinDefaultSystemConfig().ttl.jwtExpiresIn
  ).trim();
  return v as SignOptions['expiresIn'];
}

export const jwtConfig: {
  secret: string;
} = {
  secret: process.env.JWT_SECRET,
};

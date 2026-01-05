import { SignOptions } from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. Please set it in your .env file.',
  );
}

/**
 * JWT Configuration
 * - Default expiration: 6 hours
 * - Can be customized via JWT_EXPIRES_IN environment variable
 * - Examples: '1h', '30m', '24h', '7d'
 * - For sensitive operations, consider shorter expiration (e.g., '1h') with refresh tokens
 */
export const jwtConfig: {
  secret: string;
  expiresIn: SignOptions['expiresIn'];
} = {
  secret: process.env.JWT_SECRET,
  expiresIn: (process.env.JWT_EXPIRES_IN || '6h') as SignOptions['expiresIn'],
};

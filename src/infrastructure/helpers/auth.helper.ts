import { SignOptions } from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET environment variable is required. Please set it in your .env file.',
  );
}

export const jwtConfig: {
  secret: string;
  expiresIn: SignOptions['expiresIn'];
} = {
  secret: process.env.JWT_SECRET,
  expiresIn: '6h',
};

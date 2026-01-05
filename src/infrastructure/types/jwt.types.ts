/**
 * JWT Token Payload Types
 */
export interface JWTPayload {
  sub: string | number; // User ID
  login: string;
  iat?: number;
  exp?: number;
}


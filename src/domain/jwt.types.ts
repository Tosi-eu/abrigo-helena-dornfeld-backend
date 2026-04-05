export interface JWTPayload {
  sub: string | number;
  login: string;
  iat?: number;
  exp?: number;
}

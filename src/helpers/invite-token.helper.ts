import { createHash, randomBytes } from 'crypto';

const PEPPER = process.env.INVITE_TOKEN_PEPPER ?? '';

export function digestInviteTokenPlain(plain: string): string {
  const p = String(plain).trim();
  return createHash('sha256').update(`${PEPPER}${p}`, 'utf8').digest('hex');
}

export function generateInvitePlainToken(): string {
  return randomBytes(24).toString('base64url');
}

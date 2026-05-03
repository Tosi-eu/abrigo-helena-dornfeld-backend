import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

function pepperedPlain(plain: string): string {
  const pepper = process.env.CONTRACT_CODE_PEPPER ?? '';
  return `${pepper}${String(plain).trim()}`;
}

export async function hashContractCode(plain: string): Promise<string> {
  return bcrypt.hash(pepperedPlain(plain), SALT_ROUNDS);
}

export function normalizeAttestedLoginForContract(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

export async function verifyContractCode(
  storedHash: string | null | undefined,
  plain: string | undefined,
): Promise<'ok' | 'required' | 'invalid'> {
  if (!storedHash) return 'ok';
  const p = plain != null ? String(plain).trim() : '';
  if (!p) return 'required';
  const match = await bcrypt.compare(pepperedPlain(p), storedHash);
  return match ? 'ok' : 'invalid';
}

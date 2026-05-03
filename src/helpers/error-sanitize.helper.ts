/** Versão leve de sanitização para `message_sanitized` (persistência). */
export function sanitizeErrorMessageForStore(
  raw: string,
  maxLen = 2000,
): string {
  const s = raw.replace(/\s+/g, ' ').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
}

import type { Prisma, PrismaClient } from '@prisma/client';
import { withRootTransaction } from './prisma';

export interface RlsContextVars {
  current_user_id?: number | null;
  [key: string]: string | number | null | undefined;
}

export async function setRlsSessionGucs(
  db: PrismaClient | Prisma.TransactionClient,
  context: RlsContextVars,
): Promise<void> {
  const keys = Object.keys(context).filter(
    k => context[k] !== undefined && context[k] !== null,
  );

  if (keys.length === 0) return;

  for (const key of keys) {
    const value = context[key];
    const safeKey = key.replace(/[^a-z0-9_]/gi, '_');
    const appKey = `app.${safeKey}`;
    const safeValue =
      typeof value === 'number' ? String(value) : String(value);

    await db.$executeRawUnsafe(
      `SELECT set_config($1::text, $2::text, true)`,
      appKey,
      safeValue,
    );
  }
}

export async function withRlsContext<T>(
  context: RlsContextVars,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return withRootTransaction(async tx => {
    await setRlsSessionGucs(tx, context);
    return fn(tx);
  });
}

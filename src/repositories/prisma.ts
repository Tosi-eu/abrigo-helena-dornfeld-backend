import { Prisma, PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getDatabaseConfig } from '@config/database.config';

function ensureDatabaseUrl(): void {
  const c = getDatabaseConfig();
  const host = c.host?.trim();
  const user = c.user?.trim();
  const name = c.name?.trim();
  // Variáveis DB_* (ex.: DB_HOST=postgres no Docker) devem prevalecer sobre DATABASE_URL do .env com localhost
  if (host && user && name) {
    const encUser = encodeURIComponent(user);
    const encPass = encodeURIComponent(String(c.pass ?? ''));
    const rawPort = Number(process.env.DB_PORT);
    const port =
      Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 5432;
    process.env.DATABASE_URL = `postgresql://${encUser}:${encPass}@${host}:${port}/${encodeURIComponent(name)}?schema=public`;
    return;
  }
  if (process.env.DATABASE_URL?.trim()) return;
  const encUser = encodeURIComponent(String(c.user ?? ''));
  const encPass = encodeURIComponent(String(c.pass ?? ''));
  const h = c.host ?? 'localhost';
  const rawPort2 = Number(process.env.DB_PORT);
  const port2 =
    Number.isFinite(rawPort2) && rawPort2 > 0 ? rawPort2 : 5432;
  const dbName = c.name ?? '';
  process.env.DATABASE_URL = `postgresql://${encUser}:${encPass}@${h}:${port2}/${dbName}?schema=public`;
}

ensureDatabaseUrl();

const prismaSingleton = new PrismaClient();

const txStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

export const prisma = prismaSingleton;

export function getDb(): PrismaClient | Prisma.TransactionClient {
  return txStorage.getStore() ?? prisma;
}

/** Executa o callback com o client de transação atual no ALS (middleware RLS). */
export function runWithTransactionClient<T>(
  tx: Prisma.TransactionClient,
  fn: () => T,
): T {
  return txStorage.run(tx, fn);
}

export async function withRootTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn);
}

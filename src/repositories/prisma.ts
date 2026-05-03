import { Prisma, PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getDatabaseConfig } from '@config/database.config';

function ensureDatabaseUrl(): void {
  const c = getDatabaseConfig();
  const host = c.host?.trim();
  const user = c.user?.trim();
  const name = c.name?.trim();
  if (host && user && name) {
    const encUser = encodeURIComponent(user);
    const encPass = encodeURIComponent(String(c.pass ?? ''));
    const rawPort = Number(process.env.DB_PORT);
    const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 5432;
    const url = `postgresql://${encUser}:${encPass}@${host}:${port}/${encodeURIComponent(name)}?schema=public`;
    process.env.DATABASE_URL = url;
    process.env.STOKIO_DATABASE_URL = url;
    return;
  }
  if (process.env.DATABASE_URL?.trim()) {
    if (!process.env.STOKIO_DATABASE_URL?.trim()) {
      process.env.STOKIO_DATABASE_URL = process.env.DATABASE_URL;
    }
    return;
  }
  if (process.env.STOKIO_DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = process.env.STOKIO_DATABASE_URL;
    return;
  }
  const encUser = encodeURIComponent(String(c.user ?? ''));
  const encPass = encodeURIComponent(String(c.pass ?? ''));
  const h = c.host ?? 'localhost';
  const rawPort2 = Number(process.env.DB_PORT);
  const port2 = Number.isFinite(rawPort2) && rawPort2 > 0 ? rawPort2 : 5432;
  const dbName = c.name ?? '';
  const url2 = `postgresql://${encUser}:${encPass}@${h}:${port2}/${dbName}?schema=public`;
  process.env.DATABASE_URL = url2;
  process.env.STOKIO_DATABASE_URL = url2;
}

ensureDatabaseUrl();

const prismaSingleton = new PrismaClient();

const txStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

export const prisma = prismaSingleton;

export function getDb(): PrismaClient | Prisma.TransactionClient {
  return txStorage.getStore() ?? prisma;
}

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

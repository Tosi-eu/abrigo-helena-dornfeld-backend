import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { AppModule } from '@modules/app.module';
import {
  configureHttpBeforeInit,
  registerExpressErrorHandlerLast,
} from '@config/http/apply-http-stack';
import { getDatabaseConfig } from '@config/database.config';
import { seedE2EDefaultTenant } from '@helpers/e2e-tenant-seed.helper';
import { prisma } from '@repositories/prisma';
import { wireSystemConfigAfterNestInit } from '@config/bootstrap-system-config';
import { execSync } from 'node:child_process';

function isTestEnv(): boolean {
  return process.env.NODE_ENV === 'test';
}

let lastNestApp: INestApplication | null = null;

export async function closeTestApp(): Promise<void> {
  if (!lastNestApp) return;
  try {
    const httpServer: any = lastNestApp.getHttpServer?.();
    if (httpServer && typeof httpServer.close === 'function') {
      if (typeof httpServer.unref === 'function') httpServer.unref();
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
    await lastNestApp.close();
  } finally {
    lastNestApp = null;
  }
}

async function ensureTestDbSchema(): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Array<{ regclass: string | null }>>(
    `SELECT to_regclass('public.tenant')::text AS regclass`,
  );
  const hasTenantTable = Boolean(rows?.[0]?.regclass);
  if (hasTenantTable) return;

  execSync('npx prisma db push --accept-data-loss', {
    stdio: 'inherit',
    env: process.env,
  });
}

async function setupTestData() {
  if (!isTestEnv()) return;
  await prisma.$connect();
  await ensureTestDbSchema();
  await seedE2EDefaultTenant();
}

export async function createApp(): Promise<Server> {
  await setupTestData();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({
    bodyParser: false,
  });

  configureHttpBeforeInit(app);
  await app.init();
  registerExpressErrorHandlerLast(app);
  await wireSystemConfigAfterNestInit(app);

  lastNestApp = app;
  return app.getHttpServer() as Server;
}

export async function setupTestApp() {
  return createApp();
}

export { getDatabaseConfig };

import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import { AppModule } from '@modules/app.module';
import {
  configureHttpBeforeInit,
  registerExpressErrorHandlerLast,
} from '@config/http/apply-http-stack';
import { getDatabaseConfig } from '@config/database.config';
import { seedE2EDefaultTenant } from '@helpers/e2e-tenant-seed.helper';
import { prisma } from '@repositories/prisma';

function isTestEnv(): boolean {
  return process.env.NODE_ENV === 'test';
}

async function setupTestData() {
  if (!isTestEnv()) return;
  await prisma.$connect();
  await seedE2EDefaultTenant();
}

export async function createApp(): Promise<Application> {
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

  return app.getHttpAdapter().getInstance() as Application;
}

export async function setupTestApp() {
  return createApp();
}

export { getDatabaseConfig };

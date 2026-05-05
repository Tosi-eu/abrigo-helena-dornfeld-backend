import 'reflect-metadata';
import dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './modules/app.module';
import {
  configureHttpBeforeInit,
  registerExpressErrorHandlerLast,
} from './config/http/apply-http-stack';
import { setupSwagger } from './config/swagger.setup';
import { logger } from '@helpers/logger.helper';
import { wireSystemConfigAfterNestInit } from '@config/bootstrap-system-config';
import { assertPricingIntegrationComplete } from '@config/pricing-integration.validation';

dotenv.config();

export async function bootstrap(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: false,
  });

  configureHttpBeforeInit(app);
  setupSwagger(app);

  await app.init();

  registerExpressErrorHandlerLast(app);

  await wireSystemConfigAfterNestInit(app);
  assertPricingIntegrationComplete();
  logger.info('Database connection established', {
    operation: 'database',
    status: 'connected',
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  logger.info('Nest server started', {
    operation: 'server',
    port,
    host: '0.0.0.0',
    status: 'running',
  });
  logger.info('OpenAPI docs (Swagger UI)', {
    operation: 'server',
    path: '/api/v1/docs',
  });

  return app;
}

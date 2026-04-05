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
import { prisma } from '@repositories/prisma';
import { logger } from '@helpers/logger.helper';

dotenv.config();

export async function bootstrap(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bodyParser: false,
  });

  configureHttpBeforeInit(app);

  // Antes de init(): o router Nest monta em /api/v1 e consome todos os GET sob esse prefixo;
  // se o Swagger registar depois, /api/v1/docs nunca chega à UI (404).
  setupSwagger(app);

  await app.init();

  registerExpressErrorHandlerLast(app);

  await prisma.$connect();
  logger.info('Conexão com o banco estabelecida', {
    operation: 'database',
    status: 'connected',
  });

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');
  logger.info('Servidor Nest iniciado', {
    operation: 'server',
    port,
    host: '0.0.0.0',
    status: 'running',
  });
  logger.info('Stokio OpenAPI (Swagger UI)', {
    operation: 'server',
    path: '/api/v1/docs',
  });

  return app;
}

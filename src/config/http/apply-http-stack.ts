import type { INestApplication } from '@nestjs/common';
import type { Application } from 'express';
import { configureHttpLayer } from './configure-http-layer';
import { errorHandler } from '@middlewares/error-handler.middleware';
import { HttpExceptionFilter } from '@filters/http-exception.filter';

export function configureHttpBeforeInit(app: INestApplication): Application {
  const expressApp = app.getHttpAdapter().getInstance() as Application;
  configureHttpLayer(expressApp);
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  return expressApp;
}

export function registerExpressErrorHandlerLast(app: INestApplication): void {
  const expressApp = app.getHttpAdapter().getInstance() as Application;
  expressApp.use(errorHandler);
}

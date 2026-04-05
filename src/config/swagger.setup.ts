import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Stokio API')
    .setDescription(
      'REST API for inventory, storage cabinets, and multi-tenant operations. Global path prefix: `/api/v1`.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT in the `Authorization: Bearer <token>` header',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'authToken',
        description: 'Session cookie `authToken` (web clients)',
      },
      'cookie',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
  });

  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
      tryItOutEnabled: true,
      syntaxHighlight: { activate: true, theme: 'agate' },
    },
    customSiteTitle: 'Stokio — API reference',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin-bottom: 1.5rem; }
      .swagger-ui .info .title {
        font-size: 1.85rem;
        font-weight: 600;
        letter-spacing: -0.02em;
        color: #1e3a5f;
      }
    `,
  });
}

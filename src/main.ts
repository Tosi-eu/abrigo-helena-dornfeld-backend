import 'reflect-metadata';
import dotenv from 'dotenv';

dotenv.config();

import { logger } from '@helpers/logger.helper';
import { bootstrap } from './bootstrap';

void (async () => {
  try {
    await bootstrap();
  } catch (err: unknown) {
    logger.error(
      'Erro ao iniciar servidor',
      { operation: 'server' },
      err as Error,
    );
    process.exit(1);
  }
})();

import cron from 'node-cron';
import { NotificationEventRepository } from '../../database/repositories/notificacao.repository';
import { NotificationEventService } from '../../../core/services/notificacao.service';
import { logger } from '../../helpers/logger.helper';

async function runReplacementBootstrap(service: NotificationEventService) {
  try {
    const createdCount = await service.bootstrapReplacementNotifications();
    if (createdCount > 0) {
      logger.info(`[BOOTSTRAP] ${createdCount} notificações criadas.`);
    }
    logger.info(`[BOOTSTRAP] 0 notificações criadas.`);
  } catch (err) {
    logger.error(`[BOOTSTRAP] Erro ao gerar notificações ${err}`);
  }
}

export function startNotificationBootstrapJob() {
  const repo = new NotificationEventRepository();
  const service = new NotificationEventService(repo);

  runReplacementBootstrap(service);

  cron.schedule('*/30 * * * *', async () => {
    logger.debug('[CRON] Verificando notificações de reposição...');

    try {
      const createdCount = await service.bootstrapReplacementNotifications();
      logger.info(`[CRON] ${createdCount} notificações criadas.`);
    } catch (err) {
      logger.error(`[CRON] Erro ao gerar notificações ${err}`);
    }
  });
}
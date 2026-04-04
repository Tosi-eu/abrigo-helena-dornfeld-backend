import cron from 'node-cron';
import { NotificationEventRepository } from '../../database/repositories/notificacao.repository';
import { TenantConfigRepository } from '../../database/repositories/tenant-config.repository';
import { TenantConfigService } from '../../../core/services/tenant-config.service';
import { NotificationEventService } from '../../../core/services/notificacao.service';
import { logger } from '../../helpers/logger.helper';

async function runReplacementBootstrap(service: NotificationEventService) {
  try {
    const createdCount = await service.bootstrapReplacementNotifications();
    if (createdCount > 0) {
      logger.info(`[BOOTSTRAP] ${createdCount} notificações criadas.`);
    } else {
      logger.info(`[BOOTSTRAP] 0 notificações criadas.`);
    }
  } catch (err) {
    logger.error(`[BOOTSTRAP] Erro ao gerar notificações ${err}`);
  }
}

export function startNotificationBootstrapJob() {
  const repo = new NotificationEventRepository();
  const tenantConfigService = new TenantConfigService(
    new TenantConfigRepository(),
  );
  const service = new NotificationEventService(repo, tenantConfigService);

  void runReplacementBootstrap(service);

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

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaNotificationEventRepository } from '@repositories/notificacao.repository';
import { PrismaTenantConfigRepository } from '@repositories/tenant-config.repository';
import { PrismaSetorRepository } from '@repositories/setor.repository';
import { TenantConfigService } from '@services/tenant-config.service';
import { NotificationEventService } from '@services/notificacao.service';

@Injectable()
export class NotificationBootstrapCron implements OnModuleInit {
  private readonly log = new Logger(NotificationBootstrapCron.name);
  private readonly service: NotificationEventService;

  constructor() {
    const repo = new PrismaNotificationEventRepository();
    const tenantConfigService = new TenantConfigService(
      new PrismaTenantConfigRepository(),
      new PrismaSetorRepository(),
    );
    this.service = new NotificationEventService(repo, tenantConfigService);
  }

  async onModuleInit() {
    if (process.env.ENABLE_CRON !== 'true') return;
    await this.runOnce('BOOTSTRAP');
  }

  @Cron('*/30 * * * *')
  async handleCron() {
    if (process.env.ENABLE_CRON !== 'true') return;
    await this.runOnce('CRON');
  }

  private async runOnce(tag: string) {
    try {
      const createdCount =
        await this.service.bootstrapReplacementNotifications();
      this.log.log(
        `[${tag}] ${createdCount} notificações de reposição processadas.`,
      );
    } catch (err) {
      this.log.error(`[${tag}] Erro ao gerar notificações`, err as Error);
    }
  }
}

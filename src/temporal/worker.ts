import { NativeConnection, Worker } from '@temporalio/worker';
import { activityErrorInterceptorsFactory } from './activity-error-interceptor';
import { loadMergedSystemConfigFromDb } from '@config/load-system-config-from-db';
import { setSystemConfigWorkerSnapshot } from '@config/system-config-runtime';
import { applyRuntimeLogging, logger } from '@helpers/logger.helper';
import { runScheduledPriceBackfillForAllTenants } from '@services/price-backfill-scheduled.runner';
import { PriceBackfillService } from '@services/price-backfill.service';
import { finishManualPriceBackfill } from '@services/price-backfill-manual.guard';
import { getErrorMessage } from '@domain/error.types';
import { PrismaNotificationEventRepository } from '@repositories/notificacao.repository';
import { PrismaTenantConfigRepository } from '@repositories/tenant-config.repository';
import { PrismaSetorRepository } from '@repositories/setor.repository';
import { TenantConfigService } from '@services/tenant-config.service';
import { NotificationEventService } from '@services/notificacao.service';
import { prisma } from '@repositories/prisma';
import { runSystemBackup } from '@services/system-backup.runner';
import { TenantImportService } from '@services/tenant-import.service';
import { TenantPgDumpImportService } from '@services/tenant-pg-dump-import.service';
import { readFile } from 'node:fs/promises';

async function createActivities() {
  const tenantConfigService = new TenantConfigService(
    new PrismaTenantConfigRepository(),
    new PrismaSetorRepository(),
  );
  const notificationService = new NotificationEventService(
    new PrismaNotificationEventRepository(),
    tenantConfigService,
  );
  const priceBackfillService = new PriceBackfillService();
  const tenantImportService = new TenantImportService();
  const tenantPgDumpImportService = new TenantPgDumpImportService();

  return {
    runScheduledPriceBackfillForAllTenants,
    runManualPriceBackfillForTenant: async (tenantId: number) => {
      let processed = 0;
      let errMsg: string | undefined;
      try {
        processed = await priceBackfillService.runWithCronLimits(tenantId);
        return { processed };
      } catch (err) {
        errMsg =
          getErrorMessage(err) ||
          'Manual price backfill failed (Temporal activity).';
        throw err;
      } finally {
        try {
          await finishManualPriceBackfill(tenantId, {
            processed: errMsg !== undefined ? 0 : processed,
            error: errMsg,
          });
        } catch (finishErr) {
          logger.error(
            '[price-backfill] finishManualPriceBackfill falhou após atividade',
            { tenantId },
            finishErr instanceof Error
              ? finishErr
              : new Error(String(finishErr)),
          );
        }
      }
    },
    runNotificationBootstrap: async () => {
      const createdCount =
        await notificationService.bootstrapReplacementNotifications();
      return { createdCount };
    },
    runSystemBackup,
    runTenantImportJob: async (jobId: string) => {
      const job = await prisma.tenantImportJob.findUnique({
        where: { id: jobId },
      });
      if (!job) throw new Error(`Import job not found: ${jobId}`);

      await prisma.tenantImportJob.update({
        where: { id: jobId },
        data: {
          status: 'running',
          started_at: new Date(),
          error: null,
        },
      });

      try {
        const buf = Buffer.from(await readFile(job.file_path));
        const options = (job.options_json ?? {}) as any;

        if (job.kind === 'xlsx') {
          const result = await tenantImportService.importXlsx({
            tenantId: job.tenant_id,
            actorUserId: job.actor_user_id,
            fileBuffer: buf,
          });
          await prisma.tenantImportJob.update({
            where: { id: jobId },
            data: {
              status: 'succeeded',
              finished_at: new Date(),
              result_json: result as any,
            },
          });
          return;
        }

        if (job.kind === 'pg_dump') {
          const result = await tenantPgDumpImportService.importPgDump({
            tenantId: job.tenant_id,
            actorUserId: job.actor_user_id,
            fileBuffer: buf,
            replaceTenantData: Boolean(options?.replaceTenantData),
            birthDateFallback:
              typeof options?.birthDateFallback === 'string'
                ? options.birthDateFallback
                : undefined,
            sourceTenantId:
              typeof options?.sourceTenantId === 'number' &&
              Number.isFinite(options.sourceTenantId)
                ? options.sourceTenantId
                : undefined,
          } as any);
          await prisma.tenantImportJob.update({
            where: { id: jobId },
            data: {
              status: 'succeeded',
              finished_at: new Date(),
              result_json: result as any,
            },
          });
          return;
        }

        throw new Error(`Unknown job kind: ${job.kind}`);
      } catch (err) {
        await prisma.tenantImportJob.update({
          where: { id: jobId },
          data: {
            status: 'failed',
            finished_at: new Date(),
            error: getErrorMessage(err) || 'Import job failed',
          },
        });
        throw err;
      }
    },
  };
}

async function main(): Promise<void> {
  const address = process.env.TEMPORAL_ADDRESS?.trim() || 'temporal:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE?.trim() || 'default';
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE?.trim() || 'abrigo';

  try {
    const cfg = await loadMergedSystemConfigFromDb();
    setSystemConfigWorkerSnapshot(cfg);
    applyRuntimeLogging(cfg.logging);
  } catch (err) {
    logger.warn(
      '[temporal-worker] Falha ao carregar system_config — a usar valores builtin',
      {
        operation: 'temporal_worker_config',
        error: err instanceof Error ? err.message : String(err),
      },
    );
    setSystemConfigWorkerSnapshot(null);
  }

  const conn = await NativeConnection.connect({ address });
  const activities = await createActivities();

  const worker = await Worker.create({
    connection: conn,
    namespace,
    taskQueue,
    workflowsPath: require.resolve('./workflows'),
    activities,
    interceptors: {
      activity: [activityErrorInterceptorsFactory],
    },
  });

  logger.info('Temporal worker started', {
    operation: 'temporal_worker_start',
    address,
    namespace,
    taskQueue,
  });

  await worker.run();
}

main().catch(err => {
  logger.error(
    'Temporal worker failed to start',
    { operation: 'temporal_worker_start' },
    err instanceof Error ? err : new Error(String(err)),
  );
  process.exit(1);
});

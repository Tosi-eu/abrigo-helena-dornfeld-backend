import { Connection, Client } from '@temporalio/client';
import { logger } from '@helpers/logger.helper';
import { prisma } from '@repositories/prisma';
import { loadMergedSystemConfigFromDb } from '@config/load-system-config-from-db';

function envBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return String(raw).trim().toLowerCase() === 'true';
}

function isScheduleAlreadyExists(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  return msg.toLowerCase().includes('already exists');
}

async function ensurePriceBackfillSchedule(
  client: Client,
  cronExpression: string,
): Promise<void> {
  const scheduleId = 'price-backfill-cron';
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE?.trim() || 'abrigo';

  try {
    await client.schedule.create({
      scheduleId,
      spec: { cronExpressions: [cronExpression] },
      action: {
        type: 'startWorkflow',
        workflowType: 'priceBackfillCronWorkflow',
        taskQueue,
        args: [],
      },
    });

    logger.info('Temporal schedule created', {
      operation: 'temporal_schedule_create',
      scheduleId,
      cronExpression,
      workflowType: 'priceBackfillCronWorkflow',
      taskQueue,
    });
  } catch (err: unknown) {
    if (!isScheduleAlreadyExists(err)) throw err;

    const handle = client.schedule.getHandle(scheduleId);
    await handle.update(prev => ({
      spec: {
        ...prev.spec,
        cronExpressions: [cronExpression],
      },
      action: prev.action,
      policies: prev.policies,
      state: prev.state,
      memo: prev.memo,
    }));

    logger.info('Temporal schedule updated', {
      operation: 'temporal_schedule_update',
      scheduleId,
      cronExpression,
    });
  }
}

async function ensureSchedule(
  client: Client,
  scheduleId: string,
  cronExpression: string,
  workflowType: string,
): Promise<void> {
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE?.trim() || 'abrigo';

  try {
    await client.schedule.create({
      scheduleId,
      spec: { cronExpressions: [cronExpression] },
      action: {
        type: 'startWorkflow',
        workflowType,
        taskQueue,
        args: [],
      },
    });

    logger.info('Temporal schedule created', {
      operation: 'temporal_schedule_create',
      scheduleId,
      cronExpression,
      workflowType,
      taskQueue,
    });
  } catch (err: unknown) {
    const msg = String((err as { message?: string })?.message ?? '');
    if (msg.toLowerCase().includes('already exists')) {
      logger.info('Temporal schedule already exists', {
        operation: 'temporal_schedule_create',
        scheduleId,
      });
      return;
    }
    throw err;
  }
}

async function main(): Promise<void> {
  if (!envBool('ENABLE_TEMPORAL', true)) {
    logger.info('Temporal schedules disabled by env', {
      operation: 'temporal_schedule_bootstrap',
    });
    return;
  }

  const address = process.env.TEMPORAL_ADDRESS?.trim() || 'temporal:7233';
  const namespace = process.env.TEMPORAL_NAMESPACE?.trim() || 'default';

  let sys;
  try {
    sys = await loadMergedSystemConfigFromDb();
  } catch (err) {
    logger.error(
      'Failed to load system_config for Temporal cron',
      { operation: 'temporal_schedule_bootstrap' },
      err instanceof Error ? err : new Error(String(err)),
    );
    throw err;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }

  const priceCron = sys.scheduledPriceBackfill.cronExpression;
  const notifCron = process.env.NOTIFICATION_BOOTSTRAP_CRON || '*/30 * * * *';

  const conn = await Connection.connect({ address });
  const client = new Client({ connection: conn, namespace });

  await ensurePriceBackfillSchedule(client, priceCron);
  await ensureSchedule(
    client,
    'notification-bootstrap-cron',
    notifCron,
    'notificationBootstrapCronWorkflow',
  );

  logger.info('Temporal schedules bootstrapped', {
    operation: 'temporal_schedule_bootstrap',
  });
}

main().catch(err => {
  logger.error(
    'Temporal schedules bootstrap failed',
    { operation: 'temporal_schedule_bootstrap' },
    err instanceof Error ? err : new Error(String(err)),
  );
  process.exit(1);
});

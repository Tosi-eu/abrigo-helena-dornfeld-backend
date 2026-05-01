import { Connection, Client } from '@temporalio/client';
import { logger } from '@helpers/logger.helper';

function envBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return String(raw).trim().toLowerCase() === 'true';
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
  } catch (err: any) {
    const msg = String(err?.message ?? '');
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
  // Allow local host access when Temporal is published to a different port.
  // Containers should still use `temporal:7233` via compose network.
  // Example: TEMPORAL_ADDRESS=host.docker.internal:17233
  const namespace = process.env.TEMPORAL_NAMESPACE?.trim() || 'default';

  const conn = await Connection.connect({ address });
  const client = new Client({ connection: conn, namespace });

  const priceCron = process.env.PRICE_BACKFILL_CRON || '15 */2 * * *';
  const notifCron = process.env.NOTIFICATION_BOOTSTRAP_CRON || '*/30 * * * *';

  await ensureSchedule(
    client,
    'price-backfill-cron',
    priceCron,
    'priceBackfillCronWorkflow',
  );
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

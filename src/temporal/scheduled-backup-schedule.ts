import { Client } from '@temporalio/client';
import { logger } from '@helpers/logger.helper';
import { getTemporalClient } from '@temporal/client';

export type ScheduledBackupScheduleCfg = {
  enabled: boolean;
  cronExpression: string;
  timezone: string;
};

function isScheduleAlreadyExists(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  return msg.toLowerCase().includes('already exists');
}

/**
 * Cria ou atualiza o Temporal Schedule `system-backup-cron` e pausa/despausa
 * conforme `cfg.enabled`. Usado pelo bootstrap (`schedules.ts`) e após gravar
 * `runtime.scheduled_backup.*` no painel (super-admin).
 */
export async function ensureScheduledBackupSchedule(
  client: Client,
  cfg: ScheduledBackupScheduleCfg,
): Promise<void> {
  const scheduleId = 'system-backup-cron';
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE?.trim() || 'abrigo';

  const tz = cfg.timezone?.trim();
  const spec = {
    cronExpressions: [cfg.cronExpression],
    ...(tz ? { timezone: tz } : {}),
  };

  try {
    await client.schedule.create({
      scheduleId,
      spec,
      action: {
        type: 'startWorkflow',
        workflowType: 'systemBackupCronWorkflow',
        taskQueue,
        args: [],
      },
    });

    logger.info('Temporal schedule created', {
      operation: 'temporal_schedule_create',
      scheduleId,
      cronExpression: cfg.cronExpression,
      timezone: tz,
      workflowType: 'systemBackupCronWorkflow',
      taskQueue,
    });
  } catch (err: unknown) {
    if (!isScheduleAlreadyExists(err)) throw err;

    const handle = client.schedule.getHandle(scheduleId);
    await handle.update(prev => {
      const nextSpec = { ...prev.spec } as Record<string, unknown>;
      delete nextSpec.timezone;
      nextSpec.cronExpressions = [cfg.cronExpression];
      if (tz) nextSpec.timezone = tz;
      return {
        spec: nextSpec as typeof prev.spec,
        action: prev.action,
        policies: prev.policies,
        state: prev.state,
        memo: prev.memo,
      };
    });

    logger.info('Temporal schedule updated', {
      operation: 'temporal_schedule_update',
      scheduleId,
      cronExpression: cfg.cronExpression,
      timezone: tz,
    });
  }

  const handle = client.schedule.getHandle(scheduleId);
  if (cfg.enabled) {
    await handle.unpause().catch(() => undefined);
  } else {
    await handle.pause().catch(() => undefined);
  }
}

export async function syncScheduledBackupSchedule(
  cfg: ScheduledBackupScheduleCfg,
): Promise<void> {
  if (
    String(process.env.ENABLE_TEMPORAL ?? '')
      .trim()
      .toLowerCase() === 'false'
  ) {
    return;
  }
  const { client } = await getTemporalClient();
  await ensureScheduledBackupSchedule(client, cfg);
}

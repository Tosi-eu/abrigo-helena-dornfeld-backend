import type { ScheduledPriceBackfillResult } from '@services/price-backfill-scheduled.runner';
import type { SystemBackupResult } from '@services/system-backup.runner';
import type { ManualPriceBackfillStatus } from '@services/price-backfill-manual.guard';
import {
  defineQuery,
  defineSignal,
  proxyActivities,
  setHandler,
  sleep,
} from '@temporalio/workflow';

type Activities = {
  runScheduledPriceBackfillForAllTenants(): Promise<ScheduledPriceBackfillResult>;
  runManualPriceBackfillForTenant(
    tenantId: number,
  ): Promise<{ processed: number }>;
  runNotificationBootstrap(): Promise<{ createdCount: number }>;
  runSystemBackup(): Promise<SystemBackupResult>;
  getPriceBackfillManualStatus(
    tenantId: number,
  ): Promise<ManualPriceBackfillStatus>;
  runTenantImportJob(jobId: string): Promise<void>;
};

const { runScheduledPriceBackfillForAllTenants, runNotificationBootstrap } =
  proxyActivities<Activities>({
    startToCloseTimeout: '30 minutes',
    retry: {
      maximumAttempts: 8,
      initialInterval: '5s',
      backoffCoefficient: 2,
      maximumInterval: '5m',
    },
  });

const { runSystemBackup } = proxyActivities<Activities>({
  startToCloseTimeout: '2 hours',
  retry: {
    maximumAttempts: 3,
    initialInterval: '30s',
    backoffCoefficient: 2,
    maximumInterval: '15m',
  },
});

export async function priceBackfillCronWorkflow(): Promise<ScheduledPriceBackfillResult> {
  return runScheduledPriceBackfillForAllTenants();
}

export async function notificationBootstrapCronWorkflow(): Promise<{
  createdCount: number;
}> {
  return runNotificationBootstrap();
}

export async function systemBackupCronWorkflow(): Promise<SystemBackupResult> {
  return runSystemBackup();
}

export async function manualPriceBackfillWorkflow(
  tenantId: number,
): Promise<{ processed: number }> {
  const { runManualPriceBackfillForTenant } = proxyActivities<Activities>({
    startToCloseTimeout: '2 hours',
    retry: {
      maximumAttempts: 8,
      initialInterval: '10s',
      backoffCoefficient: 2,
      maximumInterval: '10m',
    },
  });
  return runManualPriceBackfillForTenant(tenantId);
}

export type PriceBackfillQueueStatus = {
  tenantId: number;
  running: boolean;
  queueLength: number;
  currentRequestId: string | null;
  nextRunAtMs: number | null;
  last: {
    finishedAtMs: number;
    processed: number;
    ok: boolean;
    error?: string;
  } | null;
};

export const priceBackfillQueueEnqueueSignal = defineSignal<[string]>(
  'priceBackfillQueueEnqueue',
);
export const priceBackfillQueueStatusQuery =
  defineQuery<PriceBackfillQueueStatus>('priceBackfillQueueStatus');

export async function priceBackfillQueueWorkflow(
  tenantId: number,
): Promise<void> {
  const { runManualPriceBackfillForTenant } = proxyActivities<Activities>({
    startToCloseTimeout: '2 hours',
    retry: {
      maximumAttempts: 8,
      initialInterval: '10s',
      backoffCoefficient: 2,
      maximumInterval: '10m',
    },
  });

  const queue: string[] = [];
  let running = false;
  let currentRequestId: string | null = null;
  let nextRunAtMs: number | null = null;
  let last: PriceBackfillQueueStatus['last'] = null;

  setHandler(priceBackfillQueueEnqueueSignal, (requestId: string) => {
    queue.push(requestId);
  });

  setHandler(priceBackfillQueueStatusQuery, () => ({
    tenantId,
    running,
    queueLength: queue.length,
    currentRequestId,
    nextRunAtMs,
    last,
  }));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (queue.length === 0) {
      await sleep('10s');
      continue;
    }

    const reqId = queue.shift()!;
    running = true;
    currentRequestId = reqId;
    nextRunAtMs = null;

    try {
      const result = await runManualPriceBackfillForTenant(tenantId);
      last = {
        finishedAtMs: Date.now(),
        processed: result.processed ?? 0,
        ok: true,
      };
    } catch (err: any) {
      last = {
        finishedAtMs: Date.now(),
        processed: 0,
        ok: false,
        error: String(err?.message ?? 'Unknown error'),
      };
    } finally {
      running = false;
      currentRequestId = null;
      nextRunAtMs = null;
    }
  }
}

export async function tenantImportJobWorkflow(jobId: string): Promise<void> {
  const { runTenantImportJob } = proxyActivities<Activities>({
    startToCloseTimeout: '6 hours',
    retry: {
      maximumAttempts: 5,
      initialInterval: '10s',
      backoffCoefficient: 2,
      maximumInterval: '10m',
    },
  });

  await runTenantImportJob(jobId);
}

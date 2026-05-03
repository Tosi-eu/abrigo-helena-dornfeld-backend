import { WorkflowNotFoundError } from '@temporalio/common';
import { logger } from '@helpers/logger.helper';
import { getTemporalClient } from '@temporal/client';
import { forceReleaseManualPriceBackfillRunLock } from '@services/price-backfill-manual.guard';

const TERMINAL_STATUSES = new Set([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'TERMINATED',
  'TIMED_OUT',
  'CONTINUED_AS_NEW',
]);

function priceBackfillQueueWorkflowId(tenantId: number): string {
  return `tenant:${tenantId}:price-backfill-queue`;
}

export async function repairStaleManualPriceBackfillLock(
  tenantId: number,
): Promise<boolean> {
  const wid = priceBackfillQueueWorkflowId(tenantId);
  try {
    const { client } = await getTemporalClient();
    const handle = client.workflow.getHandle(wid);
    const desc = await handle.describe();
    const name = desc.status.name;
    if (name === 'RUNNING' || name === 'PAUSED') {
      return false;
    }
    if (TERMINAL_STATUSES.has(name)) {
      await forceReleaseManualPriceBackfillRunLock(tenantId);
      logger.warn(
        '[price-backfill] Lock Redis libertado (workflow Temporal já não está ativo)',
        { tenantId, workflowId: wid, temporalStatus: name },
      );
      return true;
    }
    return false;
  } catch (e: unknown) {
    if (e instanceof WorkflowNotFoundError) {
      await forceReleaseManualPriceBackfillRunLock(tenantId);
      logger.warn(
        '[price-backfill] Lock Redis libertado (workflow Temporal inexistente)',
        { tenantId, workflowId: wid },
      );
      return true;
    }
    logger.error(
      '[price-backfill] Falha ao verificar estado Temporal para reparar lock',
      { tenantId, workflowId: wid },
      e instanceof Error ? e : new Error(String(e)),
    );
    return false;
  }
}

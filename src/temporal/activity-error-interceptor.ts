import { Context } from '@temporalio/activity';
import type {
  ActivityExecuteInput,
  ActivityInboundCallsInterceptor,
  Next,
} from '@temporalio/worker';
import { getErrorEventService } from '@services/error-event.service';

/**
 * Regista cada falha de atividade em `error_event` antes de re-lançar (útil para retries / flakiness).
 */
export function activityErrorInterceptorsFactory(_ctx: Context): {
  inbound: ActivityInboundCallsInterceptor;
} {
  return {
    inbound: {
      async execute(
        input: ActivityExecuteInput,
        next: Next<ActivityInboundCallsInterceptor, 'execute'>,
      ): Promise<unknown> {
        try {
          return await next(input);
        } catch (err) {
          const info = Context.current().info;
          const wf = info.workflowExecution;
          await getErrorEventService()
            .recordFromUnknown(err, {
              source: 'temporal',
              category: 'workflow',
              code: info.activityType,
              workflowId: wf?.workflowId ?? null,
              workflowRunId: wf?.runId ?? null,
              context: {
                activityId: info.activityId,
                taskQueue: info.taskQueue,
                argsPreview:
                  Array.isArray(input.args) && input.args.length > 0
                    ? String(input.args[0]).slice(0, 200)
                    : undefined,
              },
            })
            .catch(() => undefined);
          throw err;
        }
      },
    },
  };
}

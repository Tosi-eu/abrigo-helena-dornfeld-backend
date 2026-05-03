import { z } from 'zod';

const sourceEnum = z.enum([
  'backend_http',
  'temporal',
  'price_search',
  'frontend_web',
  'sdk',
]);

const severityEnum = z.enum(['info', 'warning', 'error', 'fatal']);

const categoryEnum = z.enum([
  'validation',
  'auth',
  'database',
  'integration',
  'route',
  'workflow',
  'config',
  'unknown',
]);

export const CanonicalErrorPayloadSchema = z.object({
  occurredAt: z.string().min(1),
  source: sourceEnum,
  severity: severityEnum,
  category: categoryEnum,
  code: z.string().max(60).nullable(),
  messageRaw: z.string().min(1).max(32_000),
  messageSanitized: z.string().max(2000).nullable().optional(),
  fingerprint: z.string().max(40).min(1),
  context: z.record(z.unknown()).nullable().optional(),
  stack: z.string().max(32_000).nullable().optional(),
  correlationId: z.string().max(80).nullable().optional(),
  tenantId: z.number().int().nullable().optional(),
  httpMethod: z.string().max(10).nullable().optional(),
  httpPath: z.string().max(500).nullable().optional(),
  httpStatus: z.number().int().nullable().optional(),
  workflowId: z.string().max(120).nullable().optional(),
  workflowRunId: z.string().max(120).nullable().optional(),
  originApp: z.string().max(40).nullable().optional(),
});

export type CanonicalErrorPayloadDto = z.infer<
  typeof CanonicalErrorPayloadSchema
>;

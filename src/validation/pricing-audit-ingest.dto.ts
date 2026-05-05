import { z } from 'zod';

export const PricingAuditIngestSchema = z.object({
  path: z.string().min(1).max(500),
  method: z.string().min(1).max(10),
  operation_type: z.enum(['create', 'update', 'delete']),
  resource: z.literal('pricing'),
  status_code: z.number().int(),
  duration_ms: z.number().int().min(0).max(3_600_000),
  user_id: z.number().int().positive().nullable().optional(),
  tenant_id: z.number().int().positive().nullable().optional(),
  old_value: z.record(z.unknown()).nullable().optional(),
  new_value: z.record(z.unknown()).nullable().optional(),
});

export type PricingAuditIngestBody = z.infer<typeof PricingAuditIngestSchema>;

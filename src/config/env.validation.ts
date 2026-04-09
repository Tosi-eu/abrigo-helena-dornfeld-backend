import { z } from 'zod';

const nonEmpty = (name: string) =>
  z
    .string({ required_error: `${name} é obrigatório` })
    .min(1, `${name} não pode ser vazio`);

const backendEnvSchemaProduction = z
  .object({
    NODE_ENV: z.string().optional(),
    X_API_KEY: nonEmpty('X_API_KEY'),
    JWT_SECRET: nonEmpty('JWT_SECRET'),
    DATABASE_URL: z.string().trim().min(1).optional(),
    STOKIO_DATABASE_URL: z.string().trim().min(1).optional(),
    DB_HOST: z.string().trim().min(1).optional(),
    DB_USER: z.string().trim().min(1).optional(),
    DB_NAME: z.string().trim().min(1).optional(),
    DB_PASSWORD: z.string().optional(),
    DB_PORT: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasUrl =
      Boolean(data.DATABASE_URL?.trim()) ||
      Boolean(data.STOKIO_DATABASE_URL?.trim());
    const hasParts =
      Boolean(data.DB_HOST?.trim()) &&
      Boolean(data.DB_USER?.trim()) &&
      Boolean(data.DB_NAME?.trim());
    if (!hasUrl && !hasParts) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Defina DATABASE_URL (ou STOKIO_DATABASE_URL) ou o trio DB_HOST, DB_USER e DB_NAME.',
        path: ['DATABASE_URL'],
      });
    }
  });

const backendEnvSchemaTest = z.object({
  NODE_ENV: z.literal('test'),
  DATABASE_URL: z.string().trim().min(1).optional(),
  STOKIO_DATABASE_URL: z.string().trim().min(1).optional(),
  DB_HOST: z.string().trim().min(1).optional(),
  DB_USER: z.string().trim().min(1).optional(),
  DB_NAME: z.string().trim().min(1).optional(),
  X_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().optional(),
});

export type BackendEnv = z.infer<typeof backendEnvSchemaProduction>;

function formatZodEnvError(err: z.ZodError): string {
  const lines = err.errors.map(e => {
    const key = e.path.length ? e.path.join('.') : 'env';
    return `  - ${key}: ${e.message}`;
  });
  return [
    '[env] Variáveis de ambiente inválidas ou ausentes. Corrija e reinicie.',
    ...lines,
  ].join('\n');
}

export function assertBackendEnv(): void {
  const isTest = process.env.NODE_ENV === 'test';
  const schema = isTest ? backendEnvSchemaTest : backendEnvSchemaProduction;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = formatZodEnvError(parsed.error);
    console.error(msg);
    process.exit(1);
  }
}

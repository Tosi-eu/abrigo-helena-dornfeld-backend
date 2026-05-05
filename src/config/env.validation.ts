import { z } from 'zod';

export const R2_ASSETS_REQUIRED_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_ASSETS_BUCKET_NAME',
  'R2_PUBLIC_BASE_URL',
] as const;

export function getMissingR2AssetsEnvKeys(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  return R2_ASSETS_REQUIRED_KEYS.filter(k => {
    const v = env[k]?.trim();
    return !v;
  });
}

export function isR2AssetsEnvComplete(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return getMissingR2AssetsEnvKeys(env).length === 0;
}

export function formatR2AssetsMissingMessage(missing: string[]): string {
  if (missing.length === 0) return '';
  return `Armazenamento R2 incompleto. Defina no ambiente: ${missing.join(', ')}. Ver backend/.env.example.`;
}

export function logR2AssetsEnvStatus(): void {
  if (process.env.NODE_ENV === 'test') return;
  const missing = getMissingR2AssetsEnvKeys();
  if (missing.length === 0) {
    console.log(
      '[env] R2 (logos/assets): credenciais e bucket presentes — upload de logo disponível.',
    );
    return;
  }
  const msg = formatR2AssetsMissingMessage(missing);
  console.error(`[env] ERRO FATAL: ${msg}`);
  console.error(
    '[env] A aplicação vai terminar. Corrija as variáveis ou defina ALLOW_MISSING_R2=1 apenas em desenvolvimento.',
  );
  if (process.env.ALLOW_MISSING_R2 === '1') {
    console.warn(
      '[env] ALLOW_MISSING_R2=1 — a continuar sem R2 (POST /tenant/branding/logo responderá 503).',
    );
    return;
  }
  process.exit(1);
}

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
    PRICING_API_KEY: z.string().optional(),
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
  })
  .superRefine((_data, ctx) => {
    if (process.env.ALLOW_MISSING_PRICING === '1') return;
    const k = process.env.PRICING_API_KEY?.trim();
    if (!k || k.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'PRICING_API_KEY é obrigatório (mínimo 8 caracteres, igual ao price-search). Sem pricing local: ALLOW_MISSING_PRICING=1.',
        path: ['PRICING_API_KEY'],
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

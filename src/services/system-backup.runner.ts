import { PutObjectCommand } from '@aws-sdk/client-s3';
import { execFile } from 'node:child_process';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  unlinkSync,
} from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

import { logger } from '@helpers/logger.helper';
import { prisma } from '@repositories/prisma';
import { getR2S3Client } from '@services/clients/r2-s3-client';

const execFileAsync = promisify(execFile);

export type SystemBackupResult = {
  skipped: boolean;
  uploaded: boolean;
  detail?: string;
};

function stampLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

export async function runSystemBackup(): Promise<SystemBackupResult> {
  const host = process.env.DB_HOST?.trim() || 'localhost';
  const port = Number(process.env.DB_PORT);
  const portStr = Number.isFinite(port) && port > 0 ? String(port) : '5432';
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD ?? '';
  const dbName = process.env.DB_NAME?.trim();
  if (!user || !dbName) {
    throw new Error('[system-backup] DB_USER / DB_NAME em falta no ambiente');
  }

  const rows = await prisma.$queryRaw<{ s: bigint }[]>`
    SELECT (
      (SELECT COUNT(*)::bigint FROM tenant) +
      (SELECT COUNT(*)::bigint FROM login) +
      (SELECT COUNT(*)::bigint FROM medicamento) +
      (SELECT COUNT(*)::bigint FROM insumo) +
      (SELECT COUNT(*)::bigint FROM residente) +
      (SELECT COUNT(*)::bigint FROM movimentacao) +
      (SELECT COUNT(*)::bigint FROM estoque_medicamento) +
      (SELECT COUNT(*)::bigint FROM estoque_insumo)
    ) AS s
  `;
  const total = Number(rows[0]?.s ?? 0);
  if (!Number.isFinite(total) || total <= 0) {
    logger.warn(
      '[system-backup] Sem dados nas tabelas principais — backup omitido',
    );
    return {
      skipped: true,
      uploaded: false,
      detail:
        'Backup não gerado: contagens exactas (tenant, login, medicamento, insumo, residente, movimentacao, estoque_*) são todas zero.',
    };
  }

  const baseName = `backup_${stampLocal()}`;
  const sqlPath = join(tmpdir(), `${baseName}.sql`);
  const gzPath = `${sqlPath}.gz`;

  try {
    await execFileAsync(
      'pg_dump',
      [
        '-Fp',
        '--data-only',
        '-h',
        host,
        '-p',
        portStr,
        '-U',
        user,
        '-f',
        sqlPath,
        dbName,
      ],
      {
        env: { ...process.env, PGPASSWORD: password },
        maxBuffer: 512 * 1024 * 1024,
      },
    );

    await pipeline(
      createReadStream(sqlPath),
      createGzip(),
      createWriteStream(gzPath),
    );

    let uploaded = false;
    let detail: string | undefined;

    const bucket = process.env.R2_BUCKET_NAME?.trim();
    const accountId = process.env.R2_ACCOUNT_ID?.trim();
    const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
    const skipR2 =
      String(process.env.SYSTEM_BACKUP_SKIP_R2_UPLOAD ?? '')
        .trim()
        .toLowerCase() === 'true';

    const nodeEnv = process.env.NODE_ENV?.trim() ?? '';
    const isProduction = nodeEnv === 'production';

    const r2Complete = Boolean(
      bucket && accountId && accessKeyId && secretAccessKey,
    );

    if (skipR2) {
      detail =
        'Dump e gzip concluídos; upload R2 desligado (SYSTEM_BACKUP_SKIP_R2_UPLOAD=true).';
      logger.info('[system-backup] Upload R2 desativado por env', {
        SYSTEM_BACKUP_SKIP_R2_UPLOAD: true,
      });
    } else if (!isProduction) {
      detail = `Dump e gzip concluídos; upload R2 omitido (NODE_ENV tem de ser "production"; actual: ${nodeEnv || '(vazio)'}).`;
      logger.info('[system-backup] Upload R2 omitido: não é production', {
        NODE_ENV: nodeEnv || null,
      });
    } else if (r2Complete) {
      const client = getR2S3Client();
      const body = await readFile(gzPath);
      const key = `backups/${baseName}.sql.gz`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: 'application/gzip',
        }),
      );
      uploaded = true;
      detail = `Upload R2 concluído: ${bucket}/${key}`;
      logger.info('[system-backup] Upload R2 concluído', { key });
    } else {
      const missing: string[] = [];
      if (!bucket) missing.push('R2_BUCKET_NAME');
      if (!accountId) missing.push('R2_ACCOUNT_ID');
      if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
      if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
      detail = `Dump e gzip concluídos no worker; upload omitido — falta: ${missing.join(', ')} (produção + credenciais R2).`;
      logger.info(
        '[system-backup] Upload R2 omitido (credenciais incompletas)',
        {
          missing,
        },
      );
    }

    const iso = new Date().toISOString();
    await prisma.systemConfig.upsert({
      where: { key: 'last_backup_at' },
      create: { key: 'last_backup_at', value: iso },
      update: { value: iso },
    });

    return { skipped: false, uploaded, detail };
  } finally {
    try {
      if (existsSync(sqlPath)) unlinkSync(sqlPath);
      if (existsSync(gzPath)) unlinkSync(gzPath);
    } catch {
      /* ignore */
    }
  }
}

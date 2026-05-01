import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import {
  formatR2AssetsMissingMessage,
  getMissingR2AssetsEnvKeys,
} from '../config/env.validation';

function loadEnvFiles() {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, '.env'),
    path.join(cwd, '..', '.env'),
    path.join(cwd, '..', '..', '.env'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
    }
  }
}

function main() {
  loadEnvFiles();
  const missing = getMissingR2AssetsEnvKeys();
  if (missing.length === 0) {
    console.log('[check:env:r2] Required R2 environment variables present.');
    return;
  }
  const msg = formatR2AssetsMissingMessage(missing);
  console.error(`[check:env:r2] ERROR: ${msg}`);
  if (process.env.ALLOW_MISSING_R2 === '1') {
    console.warn(
      '[check:env:r2] ALLOW_MISSING_R2=1 — check skipped (do not use in production).',
    );
    return;
  }
  process.exit(1);
}

main();

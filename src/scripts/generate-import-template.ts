import * as fs from 'fs';
import * as path from 'path';
import { buildTenantImportTemplateBuffer } from '../helpers/tenant-import-template.excel';

async function main() {
  const outArg = process.argv[2];
  const outPath = path.resolve(
    process.cwd(),
    outArg || 'template-importacao.xlsx',
  );
  const buf = await buildTenantImportTemplateBuffer();
  fs.writeFileSync(outPath, buf);
  console.log(`Template gerado: ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

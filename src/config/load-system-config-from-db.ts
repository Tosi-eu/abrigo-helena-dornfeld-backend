import {
  decodeRuntimeDbRows,
  mergeSystemConfigPatch,
  type SystemConfigDto,
} from '@domain/dto/system-config.dto';
import { prisma } from '@repositories/prisma';
import { getBuiltinDefaultSystemConfig } from '@services/system-config.defaults';

export async function loadMergedSystemConfigFromDb(): Promise<SystemConfigDto> {
  const base = getBuiltinDefaultSystemConfig();
  const rows = await prisma.systemConfig.findMany({
    where: { key: { startsWith: 'runtime.' } },
  });
  const flat: Record<string, string> = {};
  for (const r of rows) {
    if (r.value != null) flat[r.key] = r.value;
  }
  const patch = decodeRuntimeDbRows(flat);
  return mergeSystemConfigPatch(base, patch as never);
}

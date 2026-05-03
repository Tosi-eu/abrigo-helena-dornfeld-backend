import type { SystemConfigDto } from '@domain/dto/system-config.dto';
import {
  tryGetSystemConfigRuntime,
  tryGetSystemConfigWorkerSnapshot,
} from '@config/system-config-runtime';
import { getBuiltinDefaultSystemConfig } from '@services/system-config.defaults';

export function getRuntimeHttpConfig(): SystemConfigDto {
  const nest = tryGetSystemConfigRuntime()?.get();
  if (nest) return nest;
  const worker = tryGetSystemConfigWorkerSnapshot();
  if (worker) return worker;
  return getBuiltinDefaultSystemConfig();
}

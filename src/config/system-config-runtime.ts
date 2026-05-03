import type { SystemConfigDto } from '@domain/dto/system-config.dto';
import type { SystemConfigService } from '@services/system-config.service';

let runtime: SystemConfigService | null = null;

let workerSnapshot: SystemConfigDto | null = null;

export function setSystemConfigRuntime(
  service: SystemConfigService | null,
): void {
  runtime = service;
}

export function tryGetSystemConfigRuntime(): SystemConfigService | null {
  return runtime;
}

export function setSystemConfigWorkerSnapshot(
  dto: SystemConfigDto | null,
): void {
  workerSnapshot = dto;
}

export function tryGetSystemConfigWorkerSnapshot(): SystemConfigDto | null {
  return workerSnapshot;
}

export function getSystemConfigRuntime(): SystemConfigService {
  if (!runtime) {
    throw new Error(
      'SystemConfigService ainda não inicializado (bootstrap incompleto).',
    );
  }
  return runtime;
}

export const SYSTEM_CONFIG_INVALIDATED_CHANNEL = 'system_config:invalidated';

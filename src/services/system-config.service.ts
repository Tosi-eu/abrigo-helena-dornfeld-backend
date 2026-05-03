import { EventEmitter } from 'events';
import { Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import {
  decodeRuntimeDbRows,
  encodeSystemConfigToDb,
  mergeSystemConfigPatch,
  type SystemConfigDto,
  type SystemConfigPatch,
  SystemConfigSchema,
} from '@domain/dto/system-config.dto';
import { PrismaSystemConfigRepository } from '@repositories/system-config.repository';
import { getBuiltinDefaultSystemConfig } from '@services/system-config.defaults';
import { getRedisClient } from '@config/redis.client';
import {
  SYSTEM_CONFIG_INVALIDATED_CHANNEL,
  setSystemConfigRuntime,
} from '@config/system-config-runtime';
import { logger } from '@helpers/logger.helper';

@Injectable()
export class SystemConfigService {
  private readonly emitter = new EventEmitter();
  private cached: SystemConfigDto | null = null;
  private subscriber: Redis | null = null;
  private reloadScheduled = false;

  constructor(private readonly repo: PrismaSystemConfigRepository) {}

  get(): SystemConfigDto {
    if (!this.cached) {
      throw new Error('SystemConfigService.get() antes de init()');
    }
    return this.cached;
  }

  onChange(cb: () => void): () => void {
    this.emitter.on('change', cb);
    return () => this.emitter.off('change', cb);
  }

  async init(): Promise<void> {
    await this.reloadFromDb();
    this.attachRedisSubscriber();
  }

  async shutdown(): Promise<void> {
    setSystemConfigRuntime(null);
    if (this.subscriber) {
      try {
        await this.subscriber.unsubscribe(SYSTEM_CONFIG_INVALIDATED_CHANNEL);
        await this.subscriber.quit();
      } catch {
        try {
          this.subscriber.disconnect();
        } catch {
          /* ignore */
        }
      }
      this.subscriber = null;
    }
  }

  private attachRedisSubscriber(): void {
    const main = getRedisClient();
    if (!main || process.env.NODE_ENV === 'test') return;
    try {
      this.subscriber = main.duplicate();
      void this.subscriber.subscribe(SYSTEM_CONFIG_INVALIDATED_CHANNEL, () => {
        this.scheduleReloadFromPeer();
      });
      this.subscriber.on('error', err => {
        logger.warn('[SystemConfig] Redis subscriber error', { error: err });
      });
    } catch (e) {
      logger.warn('[SystemConfig] Redis subscriber não disponível', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  private scheduleReloadFromPeer(): void {
    if (this.reloadScheduled) return;
    this.reloadScheduled = true;
    setImmediate(() => {
      this.reloadScheduled = false;
      void this.reloadFromDb().catch(err => {
        logger.error('[SystemConfig] Falha ao recarregar após pub/sub', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    });
  }

  async reloadFromDb(): Promise<void> {
    const all = await this.repo.getAll();
    const fromDb = decodeRuntimeDbRows(all);
    const base = getBuiltinDefaultSystemConfig();
    const merged = mergeSystemConfigPatch(
      base,
      fromDb as unknown as SystemConfigPatch,
    );
    const parsed = SystemConfigSchema.safeParse(merged);
    if (!parsed.success) {
      logger.error(
        '[SystemConfig] Config inválida após merge; a usar defaults',
        {
          issues: parsed.error.flatten(),
        },
      );
      this.cached = getBuiltinDefaultSystemConfig();
    } else {
      this.cached = parsed.data;
    }
    setSystemConfigRuntime(this);
    this.emitter.emit('change');
  }

  async update(patch: SystemConfigPatch): Promise<SystemConfigDto> {
    const current = this.get();
    const merged = mergeSystemConfigPatch(current, patch);
    const parsed = SystemConfigSchema.safeParse(merged);
    if (!parsed.success) {
      const msg = parsed.error.errors.map(e => e.message).join('; ');
      throw new Error(`Configuração inválida: ${msg}`);
    }
    const flat = encodeSystemConfigToDb(parsed.data);
    await this.repo.setMany(flat);
    this.cached = parsed.data;
    setSystemConfigRuntime(this);
    this.emitter.emit('change');
    const redis = getRedisClient();
    if (redis && process.env.NODE_ENV !== 'test') {
      try {
        await redis.publish(SYSTEM_CONFIG_INVALIDATED_CHANNEL, '1');
      } catch (e) {
        logger.warn('[SystemConfig] publish falhou', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return this.cached;
  }
}

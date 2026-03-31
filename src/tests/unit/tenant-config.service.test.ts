import { TenantConfigService } from '../../core/services/tenant-config.service';
import type { TenantModulesConfig } from '../../core/types/tenant.types';
import type { TenantConfigRepository } from '../../infrastructure/database/repositories/tenant-config.repository';

describe('TenantConfigService (unit)', () => {
  let mockRepo: jest.Mocked<
    Pick<TenantConfigRepository, 'getByTenantId' | 'setByTenantId'>
  >;
  let service: TenantConfigService;

  beforeEach(() => {
    mockRepo = {
      getByTenantId: jest.fn(),
      setByTenantId: jest.fn(),
    };
    service = new TenantConfigService(mockRepo as TenantConfigRepository);
  });

  describe('get', () => {
    it('retorna enabled vazio quando não há linha', async () => {
      mockRepo.getByTenantId.mockResolvedValue(null);
      await expect(service.get(1)).resolves.toEqual({ enabled: [] });
    });

    it('retorna enabled vazio quando modules_json é nulo', async () => {
      mockRepo.getByTenantId.mockResolvedValue({
        tenant_id: 1,
        modules_json: null,
      } as any);
      await expect(service.get(1)).resolves.toEqual({ enabled: [] });
    });

    it('retorna enabled vazio quando JSON não passa no schema', async () => {
      mockRepo.getByTenantId.mockResolvedValue({
        tenant_id: 1,
        modules_json: { enabled: ['invalido'] },
      } as any);
      await expect(service.get(1)).resolves.toEqual({ enabled: [] });
    });

    it('retorna config parseada quando válida', async () => {
      const cfg = { enabled: ['dashboard', 'medicines'] as const };
      mockRepo.getByTenantId.mockResolvedValue({
        tenant_id: 2,
        modules_json: cfg,
      } as any);
      await expect(service.get(2)).resolves.toEqual({
        enabled: ['dashboard', 'medicines'],
      });
    });
  });

  describe('set', () => {
    it('lança erro quando módulos são inválidos', async () => {
      await expect(
        service.set(1, { enabled: ['nao_existe'] }),
      ).rejects.toThrow();
      expect(mockRepo.setByTenantId).not.toHaveBeenCalled();
    });

    it('persiste e devolve config válida', async () => {
      const payload = { enabled: ['dashboard', 'profile'] };
      mockRepo.setByTenantId.mockResolvedValue(undefined as any);
      await expect(service.set(3, payload)).resolves.toEqual(payload);
      expect(mockRepo.setByTenantId).toHaveBeenCalledWith(3, payload);
    });
  });

  describe('isEnabled', () => {
    it('reflete presença na lista enabled', () => {
      const cfg: TenantModulesConfig = {
        enabled: ['stock', 'medicines'],
      };
      expect(service.isEnabled(cfg, 'stock')).toBe(true);
      expect(service.isEnabled(cfg, 'reports')).toBe(false);
    });
  });
});

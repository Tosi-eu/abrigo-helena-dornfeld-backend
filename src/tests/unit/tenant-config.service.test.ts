import {
  TenantConfigService,
  DEFAULT_TENANT_MODULES,
} from '../../core/services/tenant-config.service';
import type { TenantModulesConfig } from '../../core/types/tenant.types';
import type { TenantConfigRepository } from '../../infrastructure/database/repositories/tenant-config.repository';

describe('TenantConfigService (unit)', () => {
  let mockRepo: jest.Mocked<
    Pick<
      TenantConfigRepository,
      'getByTenantId' | 'setByTenantId' | 'listAllTenantIds'
    >
  >;
  let service: TenantConfigService;

  beforeEach(() => {
    mockRepo = {
      getByTenantId: jest.fn(),
      setByTenantId: jest.fn(),
      listAllTenantIds: jest.fn(),
    };
    service = new TenantConfigService(mockRepo as TenantConfigRepository);
  });

  describe('get', () => {
    it('retorna DEFAULT quando não há linha', async () => {
      mockRepo.getByTenantId.mockResolvedValue(null);
      await expect(service.get(1)).resolves.toEqual({
        ...DEFAULT_TENANT_MODULES,
      });
    });

    it('retorna DEFAULT quando modules_json é nulo', async () => {
      mockRepo.getByTenantId.mockResolvedValue({
        tenant_id: 1,
        modules_json: null,
      } as any);
      await expect(service.get(1)).resolves.toEqual({
        ...DEFAULT_TENANT_MODULES,
      });
    });

    it('retorna DEFAULT quando JSON não passa no schema', async () => {
      mockRepo.getByTenantId.mockResolvedValue({
        tenant_id: 1,
        modules_json: { enabled: ['invalido'] },
      } as any);
      await expect(service.get(1)).resolves.toEqual({
        ...DEFAULT_TENANT_MODULES,
      });
    });

    it('retorna config parseada quando válida (com defaults de automação)', async () => {
      const cfg = { enabled: ['dashboard', 'medicines'] as const };
      mockRepo.getByTenantId.mockResolvedValue({
        tenant_id: 2,
        modules_json: cfg,
      } as any);
      await expect(service.get(2)).resolves.toEqual({
        enabled: ['dashboard', 'medicines'],
        automatic_price_search: true,
        automatic_reposicao_notifications: true,
      });
    });
  });

  describe('set', () => {
    it('lança erro quando módulos são inválidos', async () => {
      mockRepo.getByTenantId.mockResolvedValue(null);
      await expect(
        service.set(1, { enabled: ['nao_existe'] }),
      ).rejects.toThrow();
      expect(mockRepo.setByTenantId).not.toHaveBeenCalled();
    });

    it('persiste e devolve config válida com flags de automação', async () => {
      mockRepo.getByTenantId.mockResolvedValue(null);
      mockRepo.setByTenantId.mockResolvedValue(undefined as any);
      const payload = { enabled: ['dashboard', 'profile'] as const };
      await expect(service.set(3, payload)).resolves.toEqual({
        enabled: ['dashboard', 'profile'],
        automatic_price_search: true,
        automatic_reposicao_notifications: true,
      });
      expect(mockRepo.setByTenantId).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          enabled: ['dashboard', 'profile'],
          automatic_price_search: true,
          automatic_reposicao_notifications: true,
        }),
      );
    });
  });

  describe('isEnabled', () => {
    it('reflete presença na lista enabled', () => {
      const cfg: TenantModulesConfig = {
        enabled: ['stock', 'medicines'],
        automatic_price_search: true,
        automatic_reposicao_notifications: true,
      };
      expect(service.isEnabled(cfg, 'stock')).toBe(true);
      expect(service.isEnabled(cfg, 'reports')).toBe(false);
    });
  });
});

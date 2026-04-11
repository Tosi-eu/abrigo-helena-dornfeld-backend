import {
  TenantConfigService,
  DEFAULT_TENANT_MODULES,
} from '@services/tenant-config.service';
import type { TenantModulesConfig } from '@domain/tenant.types';
import type { PrismaTenantConfigRepository } from '@repositories/tenant-config.repository';
import type { PrismaSetorRepository } from '@repositories/setor.repository';

describe('TenantConfigService (unit)', () => {
  let mockRepo: jest.Mocked<
    Pick<
      PrismaTenantConfigRepository,
      'getByTenantId' | 'setByTenantId' | 'listAllTenantIds'
    >
  >;
  let mockSetorRepo: jest.Mocked<
    Pick<PrismaSetorRepository, 'ensureDefaultSetores' | 'keysExistForTenant'>
  >;
  let service: TenantConfigService;

  beforeEach(() => {
    mockRepo = {
      getByTenantId: jest.fn(),
      setByTenantId: jest.fn(),
      listAllTenantIds: jest.fn(),
    };
    mockSetorRepo = {
      ensureDefaultSetores: jest.fn().mockResolvedValue(undefined),
      keysExistForTenant: jest.fn().mockResolvedValue(true),
    };
    service = new TenantConfigService(
      mockRepo as PrismaTenantConfigRepository,
      mockSetorRepo as unknown as PrismaSetorRepository,
    );
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

    it('retorna config parseada quando válida (com defaults de automação e setores)', async () => {
      const cfg = { enabled: ['dashboard', 'medicines'] as const };
      mockRepo.getByTenantId.mockResolvedValue({
        tenant_id: 2,
        modules_json: cfg,
      } as any);
      await expect(service.get(2)).resolves.toEqual({
        enabled: ['dashboard', 'medicines'],
        automatic_price_search: true,
        automatic_reposicao_notifications: true,
        enabled_sectors: ['farmacia', 'enfermagem'],
      });
    });

    it('respeita enabled_sectors armazenado', async () => {
      mockRepo.getByTenantId.mockResolvedValue({
        tenant_id: 2,
        modules_json: {
          enabled: ['dashboard', 'stock'],
          enabled_sectors: ['farmacia'],
        },
      } as any);
      await expect(service.get(2)).resolves.toMatchObject({
        enabled_sectors: ['farmacia'],
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

    it('persiste e devolve config válida com flags e setores', async () => {
      mockRepo.getByTenantId.mockResolvedValue(null);
      mockRepo.setByTenantId.mockResolvedValue(undefined as any);
      const payload = { enabled: ['dashboard', 'profile'] as const };
      await expect(service.set(3, payload)).resolves.toEqual({
        enabled: ['dashboard', 'profile'],
        automatic_price_search: true,
        automatic_reposicao_notifications: true,
        enabled_sectors: ['farmacia', 'enfermagem'],
      });
      expect(mockSetorRepo.ensureDefaultSetores).toHaveBeenCalledWith(3);
      expect(mockSetorRepo.keysExistForTenant).toHaveBeenCalled();
      expect(mockRepo.setByTenantId).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          enabled: ['dashboard', 'profile'],
          automatic_price_search: true,
          automatic_reposicao_notifications: true,
          enabled_sectors: ['farmacia', 'enfermagem'],
        }),
      );
    });

    it('rejeita enabled_sectors quando o catálogo não contém as chaves', async () => {
      mockRepo.getByTenantId.mockResolvedValue(null);
      mockSetorRepo.keysExistForTenant.mockResolvedValue(false);
      await expect(
        service.set(4, {
          enabled: ['dashboard', 'profile'],
          enabled_sectors: ['psicologia'],
        }),
      ).rejects.toThrow(/catálogo/);
      expect(mockRepo.setByTenantId).not.toHaveBeenCalled();
    });
  });

  describe('isEnabled', () => {
    it('reflete presença na lista enabled', () => {
      const cfg: TenantModulesConfig = {
        enabled: ['stock', 'medicines'],
        automatic_price_search: true,
        automatic_reposicao_notifications: true,
        enabled_sectors: ['farmacia', 'enfermagem'],
      };
      expect(service.isEnabled(cfg, 'stock')).toBe(true);
      expect(service.isEnabled(cfg, 'reports')).toBe(false);
    });
  });
});

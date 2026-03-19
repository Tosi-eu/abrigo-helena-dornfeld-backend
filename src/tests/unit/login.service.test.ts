import { LoginService } from '../../core/services/login.service';
import type { LoginRepository } from '../../infrastructure/database/repositories/login.repository';
import bcrypt from 'bcrypt';

describe('LoginService (unit)', () => {
  let mockRepo: jest.Mocked<LoginRepository>;
  let service: LoginService;

  beforeEach(() => {
    mockRepo = {
      findByLogin: jest.fn(),
      findByLoginForTenant: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      listPaginated: jest.fn(),
      clearToken: jest.fn(),
      findByToken: jest.fn(),
    };
    service = new LoginService(mockRepo);
  });

  describe('create', () => {
    it('deve rejeitar senha com menos de 8 caracteres', async () => {
      mockRepo.findByLoginForTenant.mockResolvedValue(null as any);

      await expect(
        service.create({
          login: 'user1',
          password: 'ab1',
          first_name: 'A',
          last_name: 'B',
        }),
      ).rejects.toThrow(/mínimo 8 caracteres/);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('deve rejeitar senha sem letra', async () => {
      mockRepo.findByLoginForTenant.mockResolvedValue(null as any);

      await expect(
        service.create({
          login: 'user1',
          password: '12345678',
          first_name: 'A',
          last_name: 'B',
        }),
      ).rejects.toThrow(/pelo menos uma letra/);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('deve rejeitar senha sem número', async () => {
      mockRepo.findByLoginForTenant.mockResolvedValue(null as any);

      await expect(
        service.create({
          login: 'user1',
          password: 'abcdefgh',
          first_name: 'A',
          last_name: 'B',
        }),
      ).rejects.toThrow(/pelo menos um número/);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('deve rejeitar login já cadastrado', async () => {
      mockRepo.findByLoginForTenant.mockResolvedValue({
        id: 1,
        login: 'user1',
      } as any);

      await expect(
        service.create({
          login: 'user1',
          password: 'senha1234',
          first_name: 'A',
          last_name: 'B',
        }),
      ).rejects.toThrow('Usuário já cadastrado');
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('deve criar usuário com senha válida', async () => {
      mockRepo.findByLoginForTenant.mockResolvedValue(null as any);
      mockRepo.create.mockResolvedValue({
        id: 1,
        login: 'user1',
        role: 'user',
      } as any);

      const result = await service.create({
        login: 'user1',
        password: 'senha1234',
        first_name: 'João',
        last_name: 'Silva',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          login: 'user1',
          first_name: 'João',
          last_name: 'Silva',
        }),
      );
      expect(result.login).toBe('user1');
      expect(result.id).toBe(1);
    });
  });

  describe('authenticate', () => {
    it('deve retornar null se usuário não existe', async () => {
      mockRepo.findByLoginForTenant.mockResolvedValue(null as any);

      const result = await service.authenticate('inexistente', 'senha1234', 1);

      expect(result).toBeNull();
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('deve retornar null se senha não confere', async () => {
      mockRepo.findByLoginForTenant.mockResolvedValue({
        id: 1,
        login: 'user1',
        password: '$2b$10$hashed', // bcrypt hash
      } as any);

      const result = await service.authenticate('user1', 'senhaErrada', 1);

      expect(result).toBeNull();
    });

    it('deve retornar token e user quando credenciais corretas', async () => {
      const hashed = await bcrypt.hash('senha1234', 10);
      mockRepo.findByLoginForTenant.mockResolvedValue({
        id: 1,
        login: 'user1',
        password: hashed,
        role: 'user',
      } as any);
      mockRepo.update.mockResolvedValue(undefined as any);

      const result = await service.authenticate('user1', 'senha1234', 1);

      expect(result).not.toBeNull();
      expect(result!.token).toBeDefined();
      expect(result!.user).toEqual({
        id: 1,
        login: 'user1',
        role: 'user',
        tenantId: 1,
        isSuperAdmin: false,
      });
      expect(mockRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ refresh_token: result!.token }),
      );
    });
  });

  describe('getById', () => {
    it('deve retornar null se usuário não existe', async () => {
      mockRepo.findById.mockResolvedValue(null as any);

      const result = await service.getById(999);

      expect(result).toBeNull();
    });

    it('deve retornar dados do usuário sem senha', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 1,
        login: 'user1',
        first_name: 'João',
        last_name: 'Silva',
        role: 'user',
      } as any);

      const result = await service.getById(1);

      expect(result).toEqual({
        id: 1,
        login: 'user1',
        firstName: 'João',
        lastName: 'Silva',
        role: 'user',
        permissions: {
          read: true,
          create: false,
          update: false,
          delete: false,
        },
      });
    });
  });
});

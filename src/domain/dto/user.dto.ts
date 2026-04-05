import type {
  Login,
  LoginCreateWithTenant,
  LoggedUser,
  UserPermissions,
} from '@porto-sdk/sdk';

export type { Login, LoginCreateWithTenant, LoggedUser, UserPermissions };

/** Payload de criação de usuário na aplicação (estende Login do SDK). */
export type CreateUserData = Login & {
  role?: 'admin' | 'user';
  tenant_id?: number;
  is_super_admin?: boolean;
  permissions?: {
    read: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
};

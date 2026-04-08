import type {
  Login,
  LoginCreateWithTenant,
  LoggedUser,
  UserPermissions,
} from '@porto-sdk/sdk';

export type { Login, LoginCreateWithTenant, LoggedUser, UserPermissions };

export type CreateUserData = Login & {
  role?: 'admin' | 'user';
  tenant_id?: number;
  is_tenant_owner?: boolean;
  is_super_admin?: boolean;
  permissions?: {
    read: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
};

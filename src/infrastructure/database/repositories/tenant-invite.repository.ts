import { Transaction } from 'sequelize';
import TenantInviteModel from '../models/tenant-invite.model';
import {
  digestInviteTokenPlain,
  generateInvitePlainToken,
} from '../../helpers/invite-token.helper';

export class TenantInviteRepository {
  async createOne(params: {
    tenantId: number;
    createdByUserId: number | null;
    expiresAt: Date;
    email: string;
    role: 'admin' | 'user';
    permissions?: {
      read?: boolean;
      create?: boolean;
      update?: boolean;
      delete?: boolean;
    } | null;
    transaction?: Transaction;
  }): Promise<{ plainToken: string }> {
    const plainToken = generateInvitePlainToken();
    const token_digest = digestInviteTokenPlain(plainToken);
    await TenantInviteModel.create(
      {
        tenant_id: params.tenantId,
        token_digest,
        expires_at: params.expiresAt,
        email: params.email,
        role: params.role,
        permissions_json: params.permissions ?? null,
        created_by_user_id: params.createdByUserId,
      },
      { transaction: params.transaction },
    );
    return { plainToken };
  }

  async findConsumableByDigestForUpdate(
    digest: string,
    transaction: Transaction,
  ): Promise<TenantInviteModel | null> {
    return TenantInviteModel.findOne({
      where: {
        token_digest: digest,
        used_at: null,
        revoked_at: null,
      },
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
  }

  async markUsed(id: number, transaction: Transaction): Promise<void> {
    await TenantInviteModel.update(
      { used_at: new Date() },
      { where: { id }, transaction },
    );
  }
}

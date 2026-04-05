import { Prisma } from '@prisma/client';
import {
  digestInviteTokenPlain,
  generateInvitePlainToken,
} from '@helpers/invite-token.helper';
import { getDb } from '@repositories/prisma';

function db(tx?: Prisma.TransactionClient) {
  return tx ?? getDb();
}

export class PrismaTenantInviteRepository {
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
    transaction?: Prisma.TransactionClient;
  }): Promise<{ plainToken: string }> {
    const plainToken = generateInvitePlainToken();
    const token_digest = digestInviteTokenPlain(plainToken);
    await db(params.transaction).tenantInvite.create({
      data: {
        tenant_id: params.tenantId,
        token_digest,
        expires_at: params.expiresAt,
        email: params.email,
        role: params.role,
        permissions_json:
          params.permissions === undefined || params.permissions === null
            ? undefined
            : (params.permissions as Prisma.InputJsonValue),
        created_by_user_id: params.createdByUserId,
      },
    });
    return { plainToken };
  }

  async findConsumableByDigestForUpdate(
    digest: string,
    transaction: Prisma.TransactionClient,
  ): Promise<{
    id: number;
    tenant_id: number;
    expires_at: Date;
    email: string | null;
    role: string | null;
    permissions_json: Prisma.JsonValue | null;
  } | null> {
    const rows = await transaction.$queryRaw<
      {
        id: number;
        tenant_id: number;
        expires_at: Date;
        email: string | null;
        role: string | null;
        permissions_json: Prisma.JsonValue | null;
      }[]
    >(Prisma.sql`
      SELECT id, tenant_id, expires_at, email, role, permissions_json
      FROM tenant_invite
      WHERE token_digest = ${digest}
        AND used_at IS NULL
        AND revoked_at IS NULL
      FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  async markUsed(
    id: number,
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    await transaction.tenantInvite.update({
      where: { id },
      data: { used_at: new Date() },
    });
  }
}

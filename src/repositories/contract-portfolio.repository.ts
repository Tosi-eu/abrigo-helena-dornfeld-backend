import {
  hashContractCode,
  verifyContractCode,
} from '@helpers/contract-code.helper';
import { setRlsSessionGucs } from './rls.context';
import { withRootTransaction } from '@repositories/prisma';
import type { Prisma } from '@prisma/client';

export class PrismaContractPortfolioRepository {
  private static enforceSingleUse(): boolean {
    const v = String(process.env.CONTRACT_CODE_ENFORCE_SINGLE_USE ?? '').trim();
    if (!v) return true; // default: on (hardening)
    return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
  }

  private static requireExistingOnPublicSignup(): boolean {
    const v = String(process.env.CONTRACT_CODE_PUBLIC_MUST_EXIST ?? '').trim();
    if (!v) return true; // default: on (do not allow public to create portfolios)
    return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
  }

  private static db(tx?: Prisma.TransactionClient) {
    return tx;
  }

  /**
   * Apenas procura um portfolio cujo hash corresponda ao texto — não cria registos.
   * Usado na verificação pública do código (ex.: onboarding em tenant `u-*`).
   */
  async findMatchingPortfolioByPlainText(
    plain: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    id: number;
    hash: string;
    usedByTenantId: number | null;
    disabledAt: Date | null;
  } | null> {
    const trimmed = String(plain).trim();
    if (!trimmed) return null;

    const run = async (t: Prisma.TransactionClient) => {
      await setRlsSessionGucs(t, { is_super_admin: 'true' });

      const rows = await t.contractPortfolio.findMany({
        select: {
          id: true,
          contract_code_hash: true,
          used_by_tenant_id: true,
          disabled_at: true,
        },
      });

      for (const row of rows) {
        const h = row.contract_code_hash;
        if (!h) continue;
        const verdict = await verifyContractCode(h, trimmed);
        if (verdict === 'ok') {
          return {
            id: row.id,
            hash: h,
            usedByTenantId:
              row.used_by_tenant_id != null
                ? Number(row.used_by_tenant_id)
                : null,
            disabledAt: row.disabled_at ?? null,
          };
        }
      }
      return null;
    };

    if (tx) return run(tx);
    return withRootTransaction(run);
  }

  /**
   * Verificação para cadastro público (sem revelar motivo):
   * - precisa existir
   * - não pode estar desabilitado
   * - (opcional) não pode estar em uso
   */
  async isUsableContractCodeForSignup(
    plain: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const trimmed = String(plain).trim();
    if (!trimmed) return false;

    const matched = await this.findMatchingPortfolioByPlainText(trimmed, tx);
    if (!matched) return false;
    if (matched.disabledAt) return false;
    if (
      PrismaContractPortfolioRepository.enforceSingleUse() &&
      matched.usedByTenantId != null
    ) {
      return false;
    }
    return true;
  }

  async markUsed(params: {
    portfolioId: number;
    tenantId: number;
    tx: Prisma.TransactionClient;
  }): Promise<boolean> {
    const { portfolioId, tenantId, tx } = params;
    if (!PrismaContractPortfolioRepository.enforceSingleUse()) return true;

    const res = await tx.$executeRaw`
      UPDATE contract_portfolio
      SET used_by_tenant_id = ${tenantId}, used_at = NOW()
      WHERE id = ${portfolioId}
        AND disabled_at IS NULL
        AND used_by_tenant_id IS NULL
    `;
    return Number(res) > 0;
  }

  async resolveOrCreateByPlainText(
    plain: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: number; hash: string }> {
    const trimmed = String(plain).trim();
    if (!trimmed) {
      throw new Error('Código de contrato vazio');
    }

    const run = async (t: Prisma.TransactionClient) => {
      await setRlsSessionGucs(t, { is_super_admin: 'true' });

      const rows = await t.contractPortfolio.findMany({
        select: { id: true, contract_code_hash: true },
      });

      for (const row of rows) {
        const h = row.contract_code_hash;
        if (!h) continue;
        const verdict = await verifyContractCode(h, trimmed);
        if (verdict === 'ok') {
          return { id: row.id, hash: h };
        }
      }

      const hash = await hashContractCode(trimmed);
      const created = await t.contractPortfolio.create({
        data: { contract_code_hash: hash },
      });
      return {
        id: created.id,
        hash: created.contract_code_hash,
      };
    };

    if (tx) return run(tx);
    return withRootTransaction(run);
  }
}

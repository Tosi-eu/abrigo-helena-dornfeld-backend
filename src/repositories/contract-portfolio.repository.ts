import {
  hashContractCode,
  normalizeAttestedLoginForContract,
  verifyContractCode,
} from '@helpers/contract-code.helper';
import { HttpError } from '@domain/error.types';
import { setRlsSessionGucs } from './rls.context';
import { withRootTransaction } from '@repositories/prisma';
import type { Prisma } from '@prisma/client';

export class PrismaContractPortfolioRepository {
  private static enforceSingleUse(): boolean {
    const v = String(process.env.CONTRACT_CODE_ENFORCE_SINGLE_USE ?? '').trim();
    if (!v) return true;
    return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
  }

  async ensurePortfolioBindingAllowsAttestedUser(params: {
    portfolioId: number;
    attestedLoginRaw: string;
    sessionLogin: string;
    tx?: Prisma.TransactionClient;
  }): Promise<void> {
    const attested = normalizeAttestedLoginForContract(params.attestedLoginRaw);
    const session = normalizeAttestedLoginForContract(params.sessionLogin);
    if (!attested) {
      throw new HttpError(
        'Informe bound_login (e-mail) no corpo do pedido, alinhado com o seu login.',
        400,
      );
    }
    if (!session) {
      throw new HttpError('Sessão sem e-mail de login.', 401);
    }
    if (attested !== session) {
      throw new HttpError(
        'O e-mail enviado (bound_login) tem de coincidir com o e-mail da sessão.',
        403,
      );
    }

    const run = async (t: Prisma.TransactionClient) => {
      const row = await t.contractPortfolio.findUnique({
        where: { id: params.portfolioId },
        select: { boundLogin: true },
      });
      const bound = row?.boundLogin?.trim()
        ? normalizeAttestedLoginForContract(row.boundLogin)
        : '';
      if (!bound) {
        await t.contractPortfolio.update({
          where: { id: params.portfolioId },
          data: { boundLogin: attested },
        });
        return;
      }
      if (bound !== attested) {
        throw new HttpError(
          'Este código de contrato está vinculado a outro e-mail.',
          403,
        );
      }
    };

    if (params.tx) await run(params.tx);
    else await withRootTransaction(run);
  }

  async findMatchingPortfolioByPlainText(
    plain: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    id: number;
    hash: string;
    boundLogin: string | null;
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
          boundLogin: true,
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
            boundLogin: row.boundLogin ?? null,
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

  async isAttestableContractCodeForSignupVerify(
    plain: string,
    opts?: { tx?: Prisma.TransactionClient; attestedLogin?: string },
  ): Promise<boolean> {
    const trimmed = String(plain).trim();
    if (!trimmed) return false;

    const matched = await this.findMatchingPortfolioByPlainText(
      trimmed,
      opts?.tx,
    );
    if (!matched) return false;
    if (matched.disabledAt) return false;

    const bound = matched.boundLogin?.trim()
      ? normalizeAttestedLoginForContract(matched.boundLogin)
      : '';
    if (bound) {
      const attested = opts?.attestedLogin?.trim()
        ? normalizeAttestedLoginForContract(opts.attestedLogin)
        : '';
      if (!attested || attested !== bound) return false;
    }
    return true;
  }

  async isUsableContractCodeForSignup(
    plain: string,
    opts?: { tx?: Prisma.TransactionClient; attestedLogin?: string },
  ): Promise<boolean> {
    const trimmed = String(plain).trim();
    if (!trimmed) return false;

    const matched = await this.findMatchingPortfolioByPlainText(
      trimmed,
      opts?.tx,
    );
    if (!matched) return false;
    if (matched.disabledAt) return false;
    if (
      PrismaContractPortfolioRepository.enforceSingleUse() &&
      matched.usedByTenantId != null
    ) {
      return false;
    }
    const bound = matched.boundLogin?.trim()
      ? normalizeAttestedLoginForContract(matched.boundLogin)
      : '';
    if (bound) {
      const attested = opts?.attestedLogin?.trim()
        ? normalizeAttestedLoginForContract(opts.attestedLogin)
        : '';
      if (!attested || attested !== bound) return false;
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
    opts?: {
      tx?: Prisma.TransactionClient;
      boundLogin?: string | null;
    },
  ): Promise<{ id: number; hash: string; boundLogin: string | null }> {
    const trimmed = String(plain).trim();
    if (!trimmed) {
      throw new Error('Código de contrato vazio');
    }

    const run = async (t: Prisma.TransactionClient) => {
      await setRlsSessionGucs(t, { is_super_admin: 'true' });

      const rows = await t.contractPortfolio.findMany({
        select: { id: true, contract_code_hash: true, boundLogin: true },
      });

      for (const row of rows) {
        const h = row.contract_code_hash;
        if (!h) continue;
        const verdict = await verifyContractCode(h, trimmed);
        if (verdict === 'ok') {
          const existingBound = row.boundLogin?.trim()
            ? normalizeAttestedLoginForContract(row.boundLogin)
            : '';
          const incomingBound =
            opts?.boundLogin != null && String(opts.boundLogin).trim() !== ''
              ? normalizeAttestedLoginForContract(opts.boundLogin)
              : '';

          if (incomingBound) {
            if (existingBound && existingBound !== incomingBound) {
              throw new HttpError(
                'Este código já está reservado para outro e-mail.',
                409,
              );
            }
            if (!existingBound) {
              await t.contractPortfolio.update({
                where: { id: row.id },
                data: { boundLogin: incomingBound },
              });
            }
          }

          return {
            id: row.id,
            hash: h,
            boundLogin: existingBound || incomingBound || null,
          };
        }
      }

      const hash = await hashContractCode(trimmed);
      const incomingBound =
        opts?.boundLogin != null && String(opts.boundLogin).trim() !== ''
          ? normalizeAttestedLoginForContract(opts.boundLogin)
          : '';
      const created = await t.contractPortfolio.create({
        data: {
          contract_code_hash: hash,
          ...(incomingBound ? { boundLogin: incomingBound } : {}),
        },
      });
      return {
        id: created.id,
        hash: created.contract_code_hash,
        boundLogin: created.boundLogin ?? null,
      };
    };

    if (opts?.tx) return run(opts.tx);
    return withRootTransaction(run);
  }
}

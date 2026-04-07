import {
  hashContractCode,
  verifyContractCode,
} from '@helpers/contract-code.helper';
import { setRlsSessionGucs } from './rls.context';
import { withRootTransaction } from '@repositories/prisma';

export class PrismaContractPortfolioRepository {
  async resolveOrCreateByPlainText(
    plain: string,
  ): Promise<{ id: number; hash: string }> {
    const trimmed = String(plain).trim();
    if (!trimmed) {
      throw new Error('Código de contrato vazio');
    }

    return withRootTransaction(async tx => {
      await setRlsSessionGucs(tx, { is_super_admin: 'true' });

      const rows = await tx.contractPortfolio.findMany({
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
      const created = await tx.contractPortfolio.create({
        data: { contract_code_hash: hash },
      });
      return {
        id: created.id,
        hash: created.contract_code_hash,
      };
    });
  }
}

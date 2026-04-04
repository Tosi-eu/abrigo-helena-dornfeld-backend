import type { Transaction } from 'sequelize';
import {
  hashContractCode,
  verifyContractCode,
} from '../../helpers/contract-code.helper';
import { setRlsSessionGucs } from '../rls.context';
import { sequelize } from '../sequelize';
import ContractPortfolioModel from '../models/contract-portfolio.model';

export class ContractPortfolioRepository {
  /** Transação explícita + GUC super-admin para deduplicar hashes sem depender do CLS do HTTP. */
  async resolveOrCreateByPlainText(
    plain: string,
  ): Promise<{ id: number; hash: string }> {
    const trimmed = String(plain).trim();
    if (!trimmed) {
      throw new Error('Código de contrato vazio');
    }

    return sequelize.transaction(async (transaction: Transaction) => {
      await setRlsSessionGucs(
        sequelize,
        { is_super_admin: 'true' },
        transaction,
      );

      const rows = await ContractPortfolioModel.findAll({
        attributes: ['id', 'contract_code_hash'],
        transaction,
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
      const created = await ContractPortfolioModel.create(
        {
          contract_code_hash: hash,
        },
        { transaction },
      );
      return {
        id: created.id,
        hash: created.contract_code_hash,
      };
    });
  }
}

import {
  hashContractCode,
  verifyContractCode,
} from '../../helpers/contract-code.helper';
import ContractPortfolioModel from '../models/contract-portfolio.model';

export class ContractPortfolioRepository {
  async resolveOrCreateByPlainText(
    plain: string,
  ): Promise<{ id: number; hash: string }> {
    const trimmed = String(plain).trim();
    if (!trimmed) {
      throw new Error('Código de contrato vazio');
    }

    const rows = await ContractPortfolioModel.findAll({
      attributes: ['id', 'contract_code_hash'],
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
    const created = await ContractPortfolioModel.create({
      contract_code_hash: hash,
    });
    return {
      id: created.id,
      hash: created.contract_code_hash,
    };
  }
}

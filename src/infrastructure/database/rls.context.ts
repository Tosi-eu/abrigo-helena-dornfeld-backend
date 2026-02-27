import type { Sequelize, Transaction } from 'sequelize';

export interface RlsContextVars {
  current_user_id?: number | null;
  [key: string]: string | number | null | undefined;
}

export async function withRlsContext<T>(
  sequelize: Sequelize,
  context: RlsContextVars,
  fn: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  return sequelize.transaction(async transaction => {
    const keys = Object.keys(context).filter(
      k => context[k] !== undefined && context[k] !== null,
    );
    for (const key of keys) {
      const value = context[key];
      const safeKey = key.replace(/[^a-z0-9_]/gi, '_');
      const appKey = `app.${safeKey}`;
      const safeValue =
        typeof value === 'number' ? String(value) : String(value);
      await sequelize.query(`SELECT set_config(:key, :value, true)`, {
        replacements: { key: appKey, value: safeValue },
        transaction,
      });
    }
    return fn(transaction);
  });
}

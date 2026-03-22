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

    if (keys.length > 0) {
      const replacements: Record<string, string> = {};
      const setClauses = keys
        .map((key, i) => {
          const value = context[key];
          const safeKey = key.replace(/[^a-z0-9_]/gi, '_');
          const appKey = `app.${safeKey}`;
          const safeValue =
            typeof value === 'number' ? String(value) : String(value);

          replacements[`key${i}`] = appKey;
          replacements[`value${i}`] = safeValue;

          return `set_config(:key${i}, :value${i}, true)`;
        })
        .join(', ');

      await sequelize.query(`SELECT ${setClauses}`, {
        replacements,
        transaction,
      });
    }

    return fn(transaction);
  });
}

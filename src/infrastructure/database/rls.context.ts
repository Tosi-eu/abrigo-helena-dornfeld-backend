import type { Sequelize, Transaction } from 'sequelize';

/**
 * RLS (Row-Level Security) context keys that PostgreSQL session variables will use.
 * Set these with set_config(..., true) in a transaction so RLS policies can read them via
 * current_setting('app.current_user_id', true). Access: user id 1 = admin (read + write);
 * other users = read-only (SELECT only, no INSERT/UPDATE/DELETE).
 */
export interface RlsContextVars {
  current_user_id?: number | null;
  /** Add more keys as needed for RLS policies (e.g. tenant_id, role). */
  [key: string]: string | number | null | undefined;
}

/**
 * Runs a callback inside a transaction after setting PostgreSQL session variables
 * for RLS. All Sequelize queries inside the callback must use the provided transaction.
 *
 * RLS policies (migration enable-rls-all-tables): user id 1 = admin (full read/write);
 * other users = read-only (SELECT allowed, INSERT/UPDATE/DELETE denied).
 */
export async function withRlsContext<T>(
  sequelize: Sequelize,
  context: RlsContextVars,
  fn: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  return sequelize.transaction(async (transaction) => {
    const keys = Object.keys(context).filter(
      (k) => context[k] !== undefined && context[k] !== null,
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


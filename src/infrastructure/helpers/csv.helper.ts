/**
 * Convert array of objects to CSV string (UTF-8, comma-separated, quoted).
 */
export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0] as object);
  const escape = (v: unknown): string => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const headerLine = headers.map(h => escape(h)).join(',');
  const dataLines = rows.map(row =>
    headers.map(h => escape((row as Record<string, unknown>)[h])).join(','),
  );
  return [headerLine, ...dataLines].join('\r\n');
}

/**
 * Flatten report result to one or more arrays for CSV export.
 * - If result is already an array of objects → return [result]
 * - If result is object with array values (e.g. { detalhes: [], consumo_mensal: [] }) → return each array
 * - If result is object with single array (e.g. transferencias) → return [array]
 */
export function reportResultToArrays(result: unknown): Record<string, unknown>[][] {
  if (Array.isArray(result)) {
    return [result as Record<string, unknown>[]];
  }
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    const arrays: Record<string, unknown>[][] = [];
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
        arrays.push(val as Record<string, unknown>[]);
      }
    }
    if (arrays.length > 0) return arrays;
  }
  return [];
}

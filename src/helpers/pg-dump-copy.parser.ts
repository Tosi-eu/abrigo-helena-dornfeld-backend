import { gunzipSync } from 'zlib';

export type CopyBlock = {
  columns: string[];
  rows: string[][];
};

export type ParsedPgDump = Map<string, CopyBlock>;

const IGNORE_TABLES = new Set([
  'sequelizemeta',
  'audit_log',
  'login_log',
  'system_config',
]);

const COPY_LINE_RE =
  /^COPY\s+public\.(?:"([^"]+)"|(\w+))\s*\(\s*([^)]+)\s*\)\s+FROM\s+stdin\s*;/i;

function stripIdent(s: string): string {
  const t = s.trim();
  if (t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/""/g, '"');
  }
  return t;
}

function splitCopyColumns(inner: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      cur += c;
      continue;
    }
    if (!inQuotes && c === ',') {
      result.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  result.push(cur.trim());
  return result.filter(Boolean);
}

export function splitCopyRow(line: string): string[] {
  return line.split('\t');
}

export function parsePgDumpCopy(sql: string): ParsedPgDump {
  const lines = sql.split(/\r?\n/);
  const out = new Map<string, CopyBlock>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = COPY_LINE_RE.exec(line);
    if (!m) {
      i++;
      continue;
    }
    const table = String(m[1] || m[2] || '')
      .trim()
      .toLowerCase();
    const rawCols = splitCopyColumns(m[3]);
    const columns = rawCols.map(stripIdent);
    i++;
    const rows: string[][] = [];
    while (i < lines.length && lines[i] !== '\\.') {
      rows.push(splitCopyRow(lines[i]));
      i++;
    }
    if (table && !IGNORE_TABLES.has(table)) {
      out.set(table, { columns, rows });
    }
    i++;
  }
  return out;
}

export function decodePgDumpBuffer(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return gunzipSync(buf).toString('utf8');
  }
  return buf.toString('utf8');
}

export function rowByColumns(
  columns: string[],
  cells: string[],
): Record<string, string | null> {
  const o: Record<string, string | null> = {};
  for (let i = 0; i < columns.length; i++) {
    const key = stripIdent(columns[i]).toLowerCase();
    const raw = cells[i];
    if (raw === undefined || raw === '\\N') {
      o[key] = null;
    } else {
      o[key] = raw;
    }
  }
  return o;
}

export function hasColumn(columns: string[], name: string): boolean {
  const n = name.toLowerCase();
  return columns.some(c => stripIdent(c).toLowerCase() === n);
}

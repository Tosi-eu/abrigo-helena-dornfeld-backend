import type { ValidationError } from 'class-validator';

export function formatValidationErrors(errors: ValidationError[]): string {
  const walk = (e: ValidationError, prefix = ''): string[] => {
    const path = prefix + (e.property ? (prefix ? '.' : '') + e.property : '');
    const msgs: string[] = [];
    if (e.constraints) {
      for (const c of Object.values(e.constraints)) {
        msgs.push(path ? `${path}: ${c}` : String(c));
      }
    }
    if (e.children?.length) {
      for (const ch of e.children) {
        msgs.push(...walk(ch, path));
      }
    }
    return msgs;
  };
  return errors.flatMap(e => walk(e)).join('; ') || 'Validation failed';
}

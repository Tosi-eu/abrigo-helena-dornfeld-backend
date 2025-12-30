export function toLocaleDateBRT(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
}

export function formatDateToPtBr(
  input: string | Date | undefined | null,
): string {
  if (!input) return '';

  if (input instanceof Date && !isNaN(input.getTime())) {
    const iso = input.toISOString().split('T')[0];
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${year}`;
  }

  const str = String(input).trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [year, month, day] = str.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  }

  return str;
}

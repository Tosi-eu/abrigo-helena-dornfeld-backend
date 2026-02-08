export function toLocaleDateBRT(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
}

export function toBrazilDateOnly(date: Date | string): Date {
  if(!date) return new Date()
  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) {
    throw new Error(`Data inválida recebida: ${date}`);
  }

  return new Date(
    d.toLocaleDateString('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }),
  );
}

export function getTomorrow(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
}

export function getTodayAtNoonBrazil(): Date {
  const now = new Date();
  const todayInBrazil = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
  );

  todayInBrazil.setHours(12, 0, 0, 0);
  return todayInBrazil;
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

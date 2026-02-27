export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  return `R$ ${value.toFixed(2)}`;
}

export function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '-';
  }
  return value.toFixed(2);
}

export function formatMedicineName(
  nome: string | null | undefined,
  dosagem: string | null | undefined,
  unidadeMedida: string | null | undefined,
): string {
  const parts = [nome, dosagem, unidadeMedida].filter(Boolean);
  return parts.length > 0 ? parts.join(' ').trim() : nome || '-';
}

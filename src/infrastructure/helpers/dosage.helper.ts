export function normalizeDosage(dosage: string): string {
  if (!dosage || typeof dosage !== 'string') {
    return dosage;
  }

  const parts = dosage.split('/');
  const numerator = parts[0].trim().replace(',', '.');

  const numValue = parseFloat(numerator);
  if (isNaN(numValue)) {
    return dosage.trim();
  }

  const normalizedNumerator =
    numValue % 1 === 0
      ? numValue.toString()
      : numValue.toString().replace(/\.?0+$/, '');

  if (parts.length > 1) {
    const denominator = parts[1].trim().replace(',', '.');
    const denValue = parseFloat(denominator);
    if (!isNaN(denValue)) {
      const normalizedDenominator =
        denValue % 1 === 0
          ? denValue.toString()
          : denValue.toString().replace(/\.?0+$/, '');
      return `${normalizedNumerator}/${normalizedDenominator}`;
    }
    return `${normalizedNumerator}/${denominator}`;
  }

  return normalizedNumerator;
}

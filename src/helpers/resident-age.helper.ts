export function computeAgeFromBirthDate(
  birth: Date,
  ref: Date = new Date(),
): number {
  const bY = birth.getUTCFullYear();
  const bM = birth.getUTCMonth();
  const bD = birth.getUTCDate();
  const rY = ref.getUTCFullYear();
  const rM = ref.getUTCMonth();
  const rD = ref.getUTCDate();
  let age = rY - bY;
  if (rM < bM || (rM === bM && rD < bD)) age--;
  return age;
}

export function formatDateOnlyIsoUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export function parseDateOnlyInput(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  if (!m) throw new Error('Data inválida');
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function assertBirthDateNotFuture(birth: Date): void {
  const today = new Date();
  const t0 = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const b0 = Date.UTC(
    birth.getUTCFullYear(),
    birth.getUTCMonth(),
    birth.getUTCDate(),
  );
  if (b0 > t0) {
    throw new Error('Data de nascimento não pode ser no futuro');
  }
}

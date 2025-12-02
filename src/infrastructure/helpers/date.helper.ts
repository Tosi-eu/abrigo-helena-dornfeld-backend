export function toLocaleDateBRT(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

export function inferSetorKeyFromNome(nome: string): string {
  const stripped = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  const lower = stripped.toLowerCase();
  let snake = lower
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  if (!snake) snake = 'setor';
  if (snake.length > 64) {
    snake = snake.slice(0, 64).replace(/_+$/g, '');
    if (!snake) snake = 'setor';
  }
  return snake;
}

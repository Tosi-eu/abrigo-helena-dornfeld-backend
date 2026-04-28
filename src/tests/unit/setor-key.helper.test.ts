import { inferSetorKeyFromNome } from '@helpers/setor-key.helper';

describe('inferSetorKeyFromNome', () => {
  it('remove acentos e usa snake_case', () => {
    expect(inferSetorKeyFromNome('Farmácia')).toBe('farmacia');
    expect(inferSetorKeyFromNome('Enfermagem')).toBe('enfermagem');
  });

  it('espaços e pontuação viram sublinhado', () => {
    expect(inferSetorKeyFromNome('Carrinho de emergência')).toBe(
      'carrinho_de_emergencia',
    );
  });

  it('nome vazio vira fallback', () => {
    expect(inferSetorKeyFromNome('   ')).toBe('setor');
  });
});

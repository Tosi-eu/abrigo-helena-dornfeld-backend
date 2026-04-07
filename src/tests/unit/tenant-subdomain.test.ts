import { parseTenantSubdomainFromHost } from '@middlewares/tenant.middleware';

describe('parseTenantSubdomainFromHost', () => {
  it('retorna null para string vazia', () => {
    expect(parseTenantSubdomainFromHost('')).toBeNull();
  });

  it('retorna null para IPv4 (supertest / 127.0.0.1)', () => {
    expect(parseTenantSubdomainFromHost('127.0.0.1')).toBeNull();
    expect(parseTenantSubdomainFromHost('192.168.1.1')).toBeNull();
  });

  it('ignora porta após dois pontos', () => {
    expect(parseTenantSubdomainFromHost('abrigo.exemplo.com:443')).toBe(
      'abrigo',
    );
  });

  it('retorna null para localhost e host sem subdomínio', () => {
    expect(parseTenantSubdomainFromHost('localhost')).toBeNull();
    expect(parseTenantSubdomainFromHost('exemplo.com')).toBeNull();
  });

  it('retorna primeiro rótulo para host com ≥3 partes', () => {
    expect(parseTenantSubdomainFromHost('foo.bar.com')).toBe('foo');
    expect(parseTenantSubdomainFromHost('meu-abrigo.app.abrigo.com.br')).toBe(
      'meu-abrigo',
    );
  });
});

# Guia de Inicialização

## Iniciar a Aplicação

Para iniciar a aplicação, execute:

```bash
npm start
```

ou

```bash
node start.js
```

**Funciona em:** Windows, Linux e macOS ✅

O script irá:
1. Iniciar o Docker Compose (`docker compose up -d`)
2. Abrir uma tela de loading no navegador
3. Aguardar o frontend ficar pronto
4. Abrir a aplicação automaticamente em `http://localhost:8081`

## Encerrar a Aplicação

Para encerrar a aplicação, pressione `Ctrl+C` (ou `Cmd+C` no macOS) no terminal onde o script está rodando.

O script irá:
1. Executar `docker compose down` automaticamente
2. Limpar todos os tokens de autenticação no backend
3. Encerrar os containers

**Nota:** O script funciona automaticamente em Windows, Linux e macOS. Não é necessário usar scripts diferentes.

## Comandos Docker Úteis

```bash
# Iniciar containers
npm run docker:up
# ou
docker compose up -d

# Parar containers
npm run docker:down
# ou
docker compose down

# Reiniciar containers
npm run docker:restart
# ou
docker compose restart
```

## Segurança de Autenticação

- **Após restart do Docker**: Todos os tokens são automaticamente limpos, forçando novo login
- **Ao fechar com Ctrl+C**: Todos os tokens são limpos automaticamente
- **Sessões não persistem**: A aplicação sempre requer login após ser reiniciada


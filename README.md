# Backend - Sistema de Gerenciamento de Estoque

API REST desenvolvida em Node.js, TypeScript e Express para gerenciamento de estoque do Abrigo Helena Dornfeld.

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- [Node.js](https://nodejs.org/) (versão 18+ recomendada)
- [npm](https://www.npmjs.com/) ou [pnpm](https://pnpm.io/)
- [PostgreSQL](https://www.postgresql.org/download/) (versão 14+)
- [Redis](https://redis.io/download) (para cache)
- [Docker](https://www.docker.com/) (opcional, mas recomendado)

## 🚀 Instalação e Configuração

### 1. Instalar Dependências

```bash
cd backend
npm install
# ou
pnpm install
```

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na pasta `backend` com as seguintes variáveis:

```env
# Servidor
PORT=3001
NODE_ENV=development

# Banco de Dados PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=helena_dornfield_db
DB_USER=seu_usuario
DB_PASSWORD=sua_senha

# Redis (Cache)
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT (Autenticação)
JWT_SECRET=seu_jwt_secret_aqui
JWT_EXPIRES_IN=24h

# CORS (Origens permitidas)
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:5173

# Rate Limiting (por IP)
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW_MS=900000
```

O limite é aplicado **por IP**: cada endereço pode fazer no máximo `RATE_LIMIT_MAX` requisições a cada `RATE_LIMIT_WINDOW_MS` ms (padrão 15 min). Requisições OPTIONS são ignoradas.

> ⚠️ **Importante**: Substitua os valores de exemplo pelos seus dados reais. Nunca commite o arquivo `.env` no repositório.

### 3. Configurar Banco de Dados

#### Opção A: Usando Docker (Recomendado)

O banco de dados PostgreSQL e Redis podem ser iniciados usando Docker Compose:

```bash
# Na raiz do projeto
docker compose up -d postgres redis
```

#### Opção B: Instalação Local

Se preferir instalar localmente:

1. **Criar o banco de dados:**

```bash
psql -U postgres -c "CREATE DATABASE estoque;"
```

2. **Configurar conexão:**

Certifique-se de que o PostgreSQL está rodando e acessível com as credenciais configuradas no `.env`.

3. **Redis:**

Inicie o Redis localmente ou use o Docker Compose.

### 4. Executar Migrations e Seeders

O Sequelize criará automaticamente as tabelas quando o servidor iniciar pela primeira vez. Se preferir executar manualmente:

```bash
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all
```

## 🏃 Como Executar

### Modo Desenvolvimento

```bash
npm run dev
```

O servidor será iniciado em modo desenvolvimento com hot-reload em `http://localhost:3001`.

### Modo Produção

```bash
npm run build
npm start
```

### Usando Docker

```bash
docker compose up -d backend
```

## 📁 Estrutura do Projeto

```
backend/
├── src/
│   ├── core/                    # Lógica de negócio
│   │   ├── domain/              # Entidades do domínio
│   │   ├── services/            # Serviços de negócio
│   │   ├── types/               # Tipos TypeScript
│   │   └── utils/               # Utilitários
│   ├── infrastructure/          # Infraestrutura
│   │   ├── database/            # Banco de dados
│   │   │   ├── models/          # Modelos Sequelize
│   │   │   ├── migrations/      # Migrations
│   │   │   ├── repositories/    # Repositórios
│   │   │   └── redis/           # Cliente Redis
│   │   ├── helpers/             # Funções auxiliares
│   │   ├── types/               # Tipos de infraestrutura
│   │   └── web/                 # API REST
│   │       ├── controllers/     # Controladores
│   │       ├── routes/          # Rotas
│   │       └── main.ts          # Entry point
│   └── middleware/              # Middlewares
│       ├── auth.middleware.ts   # Autenticação
│       ├── rbac.middleware.ts   # Autorização
│       ├── validation.middleware.ts
│       └── ...
├── tests/                       # Testes
│   ├── unit/                    # Testes unitários
│   └── e2e/                     # Testes end-to-end
├── package.json
├── tsconfig.json
└── .env                         # Variáveis de ambiente (não versionado)
```

## 🧪 Testes

```bash
npm test

npm run test:unit

npm run test:e2e

# Modo watch
npm run test:watch
```

## 🔧 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia servidor em modo desenvolvimento |
| `npm run build` | Compila TypeScript para JavaScript |
| `npm start` | Inicia servidor em produção |
| `npm test` | Executa testes unitários |
| `npm run test:e2e` | Executa testes end-to-end |
| `npm run lint` | Verifica e corrige problemas de lint |
| `npm run format` | Formata código com Prettier |

## 📚 API Endpoints

A API está disponível em `http://localhost:3001/api/v1`

Principais rotas:

- `/login` - Autenticação
- `/medicamentos` - Gerenciamento de medicamentos
- `/insumos` - Gerenciamento de insumos
- `/estoque` - Controle de estoque
- `/movimentacoes` - Histórico de movimentações
- `/relatorios` - Geração de relatórios
- `/residentes` - Gerenciamento de residentes
- `/notificacao` - Notificações

Para documentação completa da API, consulte a pasta `src/infrastructure/web/routes/`.

## 🔐 Autenticação

A API usa JWT (JSON Web Tokens) para autenticação. Para fazer requisições autenticadas:

1. Faça login em `/api/v1/login/authenticate`
2. Use o token retornado no header `Authorization: Bearer <token>`

## 🗄️ Banco de Dados

### Modelos Principais

- `medicamento` - Medicamentos cadastrados
- `insumo` - Insumos cadastrados
- `estoque_medicamento` - Estoque de medicamentos
- `estoque_insumo` - Estoque de insumos
- `movimentacao` - Histórico de movimentações
- `residente` - Residentes do abrigo
- `notificacao` - Notificações
- `login` - Usuários do sistema
- `armario` - Armários
- `gaveta` - Gavetas

### Índices de Performance

O projeto inclui índices otimizados no PostgreSQL para melhorar a performance das queries. Os índices são criados automaticamente junto com as tabelas.

### Row-Level Security (RLS)

O sistema usa RLS no PostgreSQL com dois níveis de acesso:

- **Admin** (usuário com `id = 1`): acesso total — pode ler e escrever (SELECT, INSERT, UPDATE, DELETE) em todas as tabelas.
- **User** (demais usuários): **somente leitura** — pode apenas SELECT (ver dados); não pode criar, editar nem excluir (nenhum POST, PUT, DELETE, INSERT).

- **Helper**: `src/infrastructure/database/rls.context.ts` — `withRlsContext(sequelize, { current_user_id }, fn)` define a variável de sessão `app.current_user_id` na transação.
- **Middleware**: `rlsContextMiddleware` define `req.rlsContext` a partir do usuário autenticado; `withRls(sequelize, handler)` envolve o handler para rodar toda a lógica de DB dentro dessa transação e define `req.transaction`.
- **Migração**: `20260223130000-enable-rls-all-tables.js` habilita RLS em todas as tabelas: política de SELECT para todos; políticas de INSERT, UPDATE e DELETE apenas para admin.
- **Uso nas rotas**: As rotas de **notificação** e **estoque** usam `withRls(sequelize, ...)` e os controllers passam `req.transaction` aos services/repos; as demais rotas podem ser integradas do mesmo jeito (controller → service → repo com `transaction` opcional).

### Proteção contra escalação de privilégios (browser)

Para evitar que um usuário comum eleve o próprio nível (ex.: virar admin) via requisições manipuladas no navegador:

- **Role na tabela `login`**: a coluna `role` (`'admin'` | `'user'`) define o nível de privilégio. Novos usuários recebem **default `'user'`** no banco; o **primeiro usuário criado** (id = 1) é definido como **`'admin'`** na aplicação após o insert.
- **Admin** no middleware/API: usuários com `role === 'admin'` (não mais apenas id = 1). O RLS no PostgreSQL continua usando `current_user_id = 1` para permissões de escrita; o primeiro usuário tem id 1 e role admin.
- **Criação de usuários** (`POST /login`): **permitida**. O backend usa apenas campos permitidos (`login`, `password`, `first_name`, `last_name`). O `id` é auto-increment; **novas contas recebem `role = 'user'`**; se o usuário criado for o primeiro (id = 1), a aplicação atualiza para `role = 'admin'`.
- **Reset de senha** (`POST /login/reset-password`): apenas **admin** (role = 'admin').
- **Atualização do próprio usuário** (`PUT /login`): apenas campos permitidos; `id` e `role` não podem ser alterados pelo client.
- **Middlewares**: `requireAdmin` (403 se `role !== 'admin'`), `blockNonAdminWrites` (bloqueia POST/PUT/PATCH/DELETE para não-admin).

## 🔄 Cache

O sistema usa Redis para cache de queries frequentes. As chaves de cache são automaticamente invalidadas quando dados são modificados.

## 🛠️ Desenvolvimento

### Adicionar Nova Feature

1. Criar branch a partir de `dev`
2. Implementar feature seguindo a arquitetura do projeto
3. Adicionar testes
4. Criar Pull Request

### Padrões de Código

- Use TypeScript strict mode
- Siga a estrutura Clean Architecture
- Use ESLint e Prettier
- Escreva testes para novas features

## 📝 Logs

Os logs são exibidos no console. Em produção, configure um sistema de logging adequado.

## ⚠️ Troubleshooting

### Erro de Conexão com Banco de Dados

- Verifique se o PostgreSQL está rodando
- Confirme as credenciais no `.env`
- Verifique se o banco de dados foi criado

### Erro de Conexão com Redis

- Verifique se o Redis está rodando
- Confirme as configurações no `.env`
- Se estiver usando Docker, verifique se o container está rodando

### Porta já em uso

- Altere a porta no `.env` (variável `PORT`)
- Ou pare o processo que está usando a porta 3001

## 📄 Licença

MIT

## 👥 Autores

Guilherme Tosi

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

# Rate Limiting
RATE_LIMIT_MAX=1000
```

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

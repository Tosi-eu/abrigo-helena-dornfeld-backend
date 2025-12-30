##  Pré-requisitos

Antes de começar, certifique-se de que você tem os seguintes softwares instalados na sua máquina:

-   [Node.js](https://nodejs.org/) (versão LTS recomendada)
-   NPM (geralmente vem instalado com o Node.js)
-   [PostgreSQL](https://www.postgresql.org/download/)
-   [Git](https://git-scm.com/downloads/)
-   [Postman](https://www.postman.com/downloads/) (Recomendado para testar a API)

## 🔧 Guia de Instalação e Configuração

Siga estes passos para configurar o ambiente de desenvolvimento local.

### 1. Clonar o Repositório

Primeiro, clone o repositório do GitHub para a sua máquina local.

### 2. Instalar dependências do projeto
```npm install```

### 3. Configurar o Banco de Dados PostgreSQL
```psql -U seu_usuario_aqui -d postgres -c "CREATE DATABASE helena_dornfield_db;"```


### 4. Criar as tabelas com base no Schema
```psql -U seu_usuario_aqui -d helena_dornfield_db -f database/initial_schema.sql```

### 5. Configurar as Variáveis de Ambiente

As variáveis de ambiente guardam informações sensíveis e de configuração, como as senhas do banco de dados.

#### a. Crie o arquivo `.env`
Crie uma cópia do arquivo `.env` abaixo substituindo pelo seu `DB_USER` e `DB_PASSWORD`

#### b. Preencha o arquivo `.env` 
```env
PORT=3001
DB_HOST=localhost
DB_USER=
DB_PASSWORD=
DB_NAME=helena_dornfield_db
DB_PORT=5432 
``` 

### 5. Configurar o `.gitignore`

Este arquivo é crucial para ignorar módulos do Node (`node_modules`), variáveis de ambiente (`.env`) e outros arquivos que não devem ir para o repositório.

Verifique se o arquivo `.gitignore` existe na raiz do projeto. Se não, crie-o com o seguinte conteúdo:

```gitignore
npm-debug.log*
yarn-error.log
lerna-debug.log
node_modules/
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
*.log
```

### 6. Rodar o projeto
```npm start```

### 7. Usar o Postman para Testar e Validar

Após iniciar o servidor, você pode usar o Postman para enviar requisições para a API e verificar se os dados estão sendo salvos corretamente no banco de dados.

#### a. Exemplo de Requisição (Criar Medicamento)

Configure uma nova requisição no Postman com os seguintes detalhes para criar um novo medicamento:

-   **Método:** `POST`
-   **URL:** `http://localhost:3001/api/medicamentos`
-   **Body** (selecione `raw` e `JSON`):

```json
    {
        "nome": "Dipirona 500mg",
        "dosagem": 500,
        "unidade_medida": "mg",
        "principio_ativo": "Dipirona Sódica",
        "estoque_minimo": 10
    }
```

#### b. Como Validar no Banco de Dados

Depois de enviar a requisição e receber uma resposta de sucesso, você pode confirmar que o dado foi inserido. Conecte-se ao seu banco de dados com `psql` e execute o seguinte comando SQL:

```sql
SELECT * FROM medicamento;
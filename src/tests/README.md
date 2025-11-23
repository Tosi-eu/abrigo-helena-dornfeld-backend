# Testes do Módulo Medicamento

## 📊 Resumo Geral

| Tipo de Teste | Quantidade | Status |
|---------------|------------|--------|
| **Testes de Unidade** | 21 | ✅ Todos Passando |
| **Testes de Integração** | 11 | ✅ Todos Passando |
| **Total** | **32** | ✅ **100% Passando** |

## 📁 Estrutura de Arquivos

```
src/tests/
├── unit/
│   ├── medicamento.domain.test.js       (4 testes)
│   ├── medicamento.service.test.js      (10 testes)
│   └── medicamento.repository.test.js   (7 testes)
└── integration/
    └── medicamento.controller.test.js   (11 testes)
```

## 📈 Cobertura de Código (Módulo Medicamento)

| Arquivo | Stmts | Branch | Funcs | Lines |
|---------|-------|--------|-------|-------|
| `medicamento.js` (domain) | 100% | 100% | 100% | 100% |
| `medicamento.js` (service) | 100% | 100% | 100% | 100% |
| `PostgresMedicamentoRepository.js` | 100% | 100% | 100% | 100% |
| `medicamento.js` (controller) | 100% | 100% | 100% | 100% |

## 🧪 Detalhamento dos Testes

### 1️⃣ Testes de Unidade - Domain (4 testes)

```
✅ deve criar uma instância de Medicamento com todos os campos
✅ deve criar uma instância de Medicamento sem id (para novos medicamentos)
✅ deve permitir criar medicamento sem princípio ativo
✅ deve ser uma instância da classe Medicamento
```

### 2️⃣ Testes de Unidade - Service (10 testes)

```
✅ deve cadastrar um medicamento com dados válidos
✅ deve lançar erro se o nome não for fornecido
✅ deve lançar erro se a dosagem não for fornecida
✅ deve lançar erro se a unidade de medida não for fornecida
✅ deve lançar erro se a dosagem for zero
✅ deve lançar erro se a dosagem for negativa
✅ deve cadastrar medicamento sem princípio ativo
✅ deve propagar erro do repository
✅ deve validar campos vazios (strings vazias)
✅ deve aceitar diferentes unidades de medida
```

### 3️⃣ Testes de Unidade - Repository (7 testes)

```
✅ deve criar um medicamento no banco de dados e retornar uma entidade de domínio
✅ deve criar medicamento com princípio ativo null quando não fornecido
✅ deve definir princípio ativo como null explicitamente quando undefined
✅ deve lançar erro personalizado quando o banco de dados falha
✅ deve preservar todos os dados ao criar medicamento
✅ deve lidar com erro de conexão do banco de dados
✅ deve converter valores corretamente ao criar entidade de domínio
```

### 4️⃣ Testes de Integração - Controller (11 testes)

```
✅ deve retornar 201 e o medicamento criado quando os dados são válidos
✅ deve retornar 400 quando o nome não é fornecido
✅ deve retornar 400 quando a dosagem não é fornecida
✅ deve retornar 400 quando a unidade de medida não é fornecida
✅ deve retornar 400 quando a dosagem é zero
✅ deve retornar 400 quando a dosagem é negativa
✅ deve criar medicamento sem princípio ativo
✅ deve retornar 400 com mensagem de erro do banco de dados
✅ deve aceitar e processar corpo JSON válido
✅ deve processar requisição com diferentes unidades de medida
✅ deve retornar JSON mesmo em caso de erro
```

## 🚀 Como Executar

### Executar Todos os Testes
```bash
npm test
```

### Executar Apenas Testes de Unidade
```bash
npm run test:unit
```

### Executar Apenas Testes de Integração
```bash
npm run test:integration
```

### Executar com Cobertura
```bash
npm run test:coverage
```

### Modo Watch (Desenvolvimento)
```bash
npm run test:watch
```

## 🎯 O Que Foi Testado

### ✅ Casos de Sucesso
- Criação de medicamento com dados válidos
- Criação de medicamento sem princípio ativo
- Diferentes unidades de medida (mg, ml, g, mcg, etc.)
- Processamento de requisições HTTP válidas

### ✅ Validações de Negócio
- Nome obrigatório
- Dosagem obrigatória
- Unidade de medida obrigatória
- Dosagem deve ser positiva (> 0)
- Strings vazias não são aceitas

### ✅ Tratamento de Erros
- Erros do banco de dados
- Erros de validação
- Erros de conexão
- Propagação correta de erros entre camadas

### ✅ Integridade de Dados
- Preservação de todos os dados
- Conversão correta de tipos
- Tratamento de valores null/undefined
- Retorno de entidades de domínio corretas

## 🛠️ Tecnologias Utilizadas

- **Jest** - Framework de testes JavaScript
- **Supertest** - Biblioteca para testar APIs HTTP
- **Mocks do Jest** - Para isolar componentes em testes unitários

## 📋 Padrões e Boas Práticas

✅ **AAA Pattern** (Arrange-Act-Assert)  
✅ **Isolamento de testes** com mocks  
✅ **Nomenclatura descritiva**  
✅ **Testes independentes**  
✅ **Cobertura completa** (happy path + edge cases)  
✅ **Organização por camadas** (domain, service, repository, controller)

## 📝 Observações

- Os testes de unidade usam mocks para isolar cada componente
- Os testes de integração testam o fluxo completo HTTP → Controller → Service (mockado)
- Todos os testes passam em ~2 segundos
- A cobertura do módulo medicamento é de **100%** em todas as métricas


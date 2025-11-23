# Documentação de Testes - Módulo Medicamento

## Visão Geral

Este documento descreve a estrutura e a execução dos testes implementados para o módulo de **Medicamento** da API Abrigo Helena Dornfield.

## Estrutura de Testes

Os testes foram organizados em duas categorias principais:

### 1. Testes de Unidade (`src/tests/unit/`)

Testes que verificam o comportamento de componentes individuais de forma isolada, usando mocks para dependências externas.

#### 1.1 Testes da Entidade de Domínio (`medicamento.domain.test.js`)

**Arquivo testado:** `src/core/domain/medicamento.js`

**Testes implementados:**
- ✅ Criação de instância com todos os campos
- ✅ Criação de instância sem ID (novos medicamentos)
- ✅ Criação de medicamento sem princípio ativo
- ✅ Verificação de tipo da instância

**Total:** 4 testes

---

#### 1.2 Testes do Service (`medicamento.service.test.js`)

**Arquivo testado:** `src/core/application/services/medicamento.js`

**Testes implementados:**
- ✅ Cadastro de medicamento com dados válidos
- ✅ Validação de nome obrigatório
- ✅ Validação de dosagem obrigatória
- ✅ Validação de unidade de medida obrigatória
- ✅ Validação de dosagem zero (deve ser positiva)
- ✅ Validação de dosagem negativa
- ✅ Cadastro sem princípio ativo
- ✅ Propagação de erros do repository
- ✅ Validação de campos vazios (strings vazias)
- ✅ Aceitação de diferentes unidades de medida

**Total:** 10 testes

---

#### 1.3 Testes do Repository (`medicamento.repository.test.js`)

**Arquivo testado:** `src/infrastructure/database/repositories/PostgresMedicamentoRepository.js`

**Testes implementados:**
- ✅ Criação de medicamento no banco e retorno de entidade de domínio
- ✅ Criação com princípio ativo null
- ✅ Definição explícita de princípio ativo como null quando undefined
- ✅ Tratamento de erros do banco de dados
- ✅ Preservação de todos os dados ao criar
- ✅ Tratamento de erro de conexão
- ✅ Conversão correta de valores ao criar entidade de domínio

**Total:** 7 testes

---

### 2. Testes de Integração (`src/tests/integration/`)

Testes que verificam a integração entre múltiplas camadas, especialmente a camada HTTP (Controller).

#### 2.1 Testes do Controller (`medicamento.controller.test.js`)

**Arquivo testado:** `src/infrastructure/web/controllers/medicamento.js`

**Rota testada:** `POST /api/medicamentos`

**Testes implementados:**
- ✅ Retorno 201 com medicamento criado (dados válidos)
- ✅ Retorno 400 quando nome não é fornecido
- ✅ Retorno 400 quando dosagem não é fornecida
- ✅ Retorno 400 quando unidade de medida não é fornecida
- ✅ Retorno 400 quando dosagem é zero
- ✅ Retorno 400 quando dosagem é negativa
- ✅ Criação de medicamento sem princípio ativo
- ✅ Retorno 400 com mensagem de erro do banco
- ✅ Processamento de corpo JSON válido
- ✅ Processamento de diferentes unidades de medida
- ✅ Retorno JSON em caso de erro

**Total:** 11 testes

---

## Como Executar os Testes

### Pré-requisitos

```bash
npm install
```

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

### Executar Testes em Modo Watch (desenvolvimento)

```bash
npm run test:watch
```

### Gerar Relatório de Cobertura

```bash
npm run test:coverage
```

---

## Resultados dos Testes

### Resumo da Última Execução

```
Test Suites: 4 passed, 4 total
Tests:       32 passed, 32 total
Snapshots:   0 total
Time:        ~2s
```

### Cobertura por Arquivo

| Arquivo | Camada | Testes |
|---------|--------|--------|
| `medicamento.js` (domain) | Domínio | 4 |
| `medicamento.js` (service) | Aplicação | 10 |
| `PostgresMedicamentoRepository.js` | Infraestrutura | 7 |
| `medicamento.js` (controller) | Web | 11 |

---

## Tecnologias Utilizadas

- **Jest** - Framework de testes
- **Supertest** - Testes de requisições HTTP
- **Jest Mocks** - Mocking de dependências

---

## Padrões de Teste Utilizados

### 1. Arrange-Act-Assert (AAA)

Todos os testes seguem o padrão AAA:

```javascript
it('deve criar um medicamento', async () => {
  // Arrange - Preparação dos dados
  const medicamentoData = { ... };
  
  // Act - Execução da ação
  const resultado = await service.cadastrarNovo(medicamentoData);
  
  // Assert - Verificação dos resultados
  expect(resultado).toBeDefined();
});
```

### 2. Mocking de Dependências

Os testes de unidade usam mocks para isolar o componente testado:

```javascript
const mockRepository = {
  create: jest.fn()
};

const service = new MedicamentoService(mockRepository);
```

### 3. Testes de Casos Extremos

Todos os componentes incluem testes para:
- Dados válidos (happy path)
- Validações de campos obrigatórios
- Validações de regras de negócio
- Tratamento de erros
- Casos extremos (valores nulos, vazios, negativos, etc.)

---

## Próximos Passos

### Melhorias Futuras

- [ ] Adicionar testes E2E (End-to-End) com banco de dados real
- [ ] Implementar testes para os métodos `listarTodos()` e `buscarPorId()`
- [ ] Adicionar testes para operações de UPDATE e DELETE
- [ ] Configurar CI/CD para executar testes automaticamente
- [ ] Adicionar testes de performance
- [ ] Implementar testes de segurança (SQL Injection, XSS, etc.)

### Outras Funcionalidades a Testar

- [ ] Módulo de Paciente
- [ ] Módulo de Armário
- [ ] Módulo de Estoque
- [ ] Integração entre módulos

---

## Estrutura de Arquivos de Teste

```
src/tests/
├── unit/
│   ├── medicamento.domain.test.js
│   ├── medicamento.service.test.js
│   └── medicamento.repository.test.js
└── integration/
    ├── medicamento.controller.test.js
    └── medicamento-test.js (arquivo antigo)
```

---

## Boas Práticas Implementadas

1. ✅ **Isolamento de Testes** - Cada teste é independente e pode ser executado isoladamente
2. ✅ **Nomenclatura Clara** - Nomes descritivos que explicam o que está sendo testado
3. ✅ **Mocks Apropriados** - Uso de mocks apenas para dependências externas
4. ✅ **Cobertura Abrangente** - Testes para casos de sucesso e falha
5. ✅ **Organização por Camadas** - Testes organizados seguindo a arquitetura do projeto
6. ✅ **Testes Rápidos** - Todos os testes executam em ~2 segundos

---

## Contato e Contribuição

Para dúvidas ou sugestões sobre os testes, entre em contato com a equipe de desenvolvimento.


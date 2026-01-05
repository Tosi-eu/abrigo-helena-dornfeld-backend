# 📚 Exemplos Práticos de Testes

Este documento mostra exemplos práticos de como os testes foram implementados e como criar novos testes seguindo o mesmo padrão.

## 📖 Índice

1. [Testes de Unidade - Domain](#1-testes-de-unidade---domain)
2. [Testes de Unidade - Service](#2-testes-de-unidade---service)
3. [Testes de Unidade - Repository](#3-testes-de-unidade---repository)
4. [Testes de Integração - Controller](#4-testes-de-integração---controller)
5. [Como Criar Novos Testes](#5-como-criar-novos-testes)

---

## 1. Testes de Unidade - Domain

### Exemplo: Testar a Criação de uma Entidade

```javascript
const Medicamento = require('../../core/domain/medicamento');

describe('Medicamento Domain Entity', () => {
  it('deve criar uma instância de Medicamento com todos os campos', () => {
    // Arrange - Preparar os dados
    const id = 1;
    const nome = 'Paracetamol';
    const dosagem = 500;
    const unidade_medida = 'mg';
    const principio_ativo = 'Paracetamol';
    const estoque_minimo = 50;

    // Act - Executar a ação
    const medicamento = new Medicamento(
      id,
      nome,
      dosagem,
      unidade_medida,
      principio_ativo,
      estoque_minimo
    );

    // Assert - Verificar o resultado
    expect(medicamento.id).toBe(1);
    expect(medicamento.nome).toBe('Paracetamol');
    expect(medicamento.dosagem).toBe(500);
    expect(medicamento).toBeInstanceOf(Medicamento);
  });
});
```

**Por que este teste é importante?**
- Garante que a entidade pode ser criada corretamente
- Verifica que todos os campos são atribuídos
- Confirma o tipo da instância

---

## 2. Testes de Unidade - Service

### Exemplo: Testar Validação de Negócio

```javascript
const MedicamentoService = require('../../core/application/services/medicamento');

describe('MedicamentoService', () => {
  let service;
  let mockRepository;

  beforeEach(() => {
    // Criar mock do repository antes de cada teste
    mockRepository = {
      create: jest.fn()
    };
    service = new MedicamentoService(mockRepository);
  });

  it('deve lançar erro se a dosagem for negativa', async () => {
    // Arrange
    const medicamentoData = {
      nome: 'Paracetamol',
      dosagem: -100,
      unidade_medida: 'mg',
      estoque_minimo: 50
    };

    // Act & Assert
    await expect(service.cadastrarNovo(medicamentoData))
      .rejects
      .toThrow('A dosagem deve ser um valor positivo.');

    // Verificar que o repository NÃO foi chamado
    expect(mockRepository.create).not.toHaveBeenCalled();
  });
});
```

**Por que usar mocks?**
- Isola o service do repository
- Testa apenas a lógica de negócio
- Testes mais rápidos (sem banco de dados)
- Controle total sobre o comportamento das dependências

---

## 3. Testes de Unidade - Repository

### Exemplo: Testar Interação com Banco de Dados (Mockado)

```javascript
const PostgresMedicamentoRepository = require('../../infrastructure/database/repositories/PostgresMedicamentoRepository');
const MedicamentoModel = require('../../infrastructure/database/models/medicamento');
const Medicamento = require('../../core/domain/medicamento');

// Mock do Model do Sequelize
jest.mock('../../infrastructure/database/models/medicamento');

describe('PostgresMedicamentoRepository', () => {
  let repository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PostgresMedicamentoRepository();
  });

  it('deve criar um medicamento no banco e retornar entidade de domínio', async () => {
    // Arrange
    const medicamentoData = {
      nome: 'Paracetamol',
      dosagem: 500,
      unidade_medida: 'mg',
      estoque_minimo: 50
    };

    // Simular o retorno do banco de dados
    const medicamentoRecord = {
      id: 1,
      ...medicamentoData
    };

    MedicamentoModel.create.mockResolvedValue(medicamentoRecord);

    // Act
    const resultado = await repository.create(medicamentoData);

    // Assert
    expect(MedicamentoModel.create).toHaveBeenCalledWith(
      expect.objectContaining(medicamentoData)
    );
    expect(resultado).toBeInstanceOf(Medicamento);
    expect(resultado.id).toBe(1);
    expect(resultado.nome).toBe('Paracetamol');
  });
});
```

**Por que mockar o Model?**
- Não precisa de banco de dados rodando
- Testes executam muito mais rápido
- Controle sobre valores retornados
- Fácil simular erros do banco

---

## 4. Testes de Integração - Controller

### Exemplo: Testar Requisição HTTP Completa

```javascript
const request = require('supertest');
const express = require('express');
const MedicamentoController = require('../../infrastructure/web/controllers/medicamento');

describe('MedicamentoController', () => {
  let app;
  let controller;
  let mockService;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockService = {
      cadastrarNovo: jest.fn()
    };

    controller = new MedicamentoController(mockService);
    app.post('/api/v1/medicamentos', (req, res) => controller.create(req, res));
  });

  it('deve retornar 201 quando medicamento é criado com sucesso', async () => {
    // Arrange
    const medicamentoData = {
      nome: 'Paracetamol',
      dosagem: 500,
      unidade_medida: 'mg',
      estoque_minimo: 50
    };

    const medicamentoCriado = {
      id: 1,
      ...medicamentoData
    };

    mockService.cadastrarNovo.mockResolvedValue(medicamentoCriado);

    // Act & Assert
    const response = await request(app)
      .post('/api/v1/medicamentos')
      .send(medicamentoData)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(response.body).toEqual(medicamentoCriado);
    expect(mockService.cadastrarNovo).toHaveBeenCalledWith(medicamentoData);
  });

  it('deve retornar 400 quando há erro de validação', async () => {
    // Arrange
    const medicamentoData = {
      dosagem: 500,
      unidade_medida: 'mg'
      // nome ausente
    };

    mockService.cadastrarNovo.mockRejectedValue(
      new Error('Nome, dosagem e unidade de medida são campos obrigatórios.')
    );

    // Act & Assert
    const response = await request(app)
      .post('/api/v1/medicamentos')
      .send(medicamentoData)
      .expect(400);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('campos obrigatórios');
  });
});
```

**Por que testar o Controller?**
- Verifica o fluxo HTTP completo
- Testa códigos de status HTTP
- Confirma formato de resposta JSON
- Valida headers da resposta

---

## 5. Como Criar Novos Testes

### Template para Teste de Unidade

```javascript
const MinhaClasse = require('../../caminho/para/MinhaClasse');

describe('MinhaClasse', () => {
  let instancia;
  let mockDependencia;

  beforeEach(() => {
    // Setup antes de cada teste
    mockDependencia = {
      metodo: jest.fn()
    };
    instancia = new MinhaClasse(mockDependencia);
  });

  afterEach(() => {
    // Limpeza após cada teste
    jest.clearAllMocks();
  });

  describe('meuMetodo', () => {
    it('deve fazer algo quando condição X', async () => {
      // Arrange
      const entrada = { /* dados */ };
      mockDependencia.metodo.mockResolvedValue({ /* resultado */ });

      // Act
      const resultado = await instancia.meuMetodo(entrada);

      // Assert
      expect(resultado).toBeDefined();
      expect(mockDependencia.metodo).toHaveBeenCalledWith(entrada);
    });

    it('deve lançar erro quando condição Y', async () => {
      // Arrange
      const entradaInvalida = { /* dados inválidos */ };

      // Act & Assert
      await expect(instancia.meuMetodo(entradaInvalida))
        .rejects
        .toThrow('Mensagem de erro esperada');
    });
  });
});
```

### Template para Teste de Integração

```javascript
const request = require('supertest');
const express = require('express');
const MeuController = require('../../caminho/para/MeuController');

describe('MeuController - Integração', () => {
  let app;
  let controller;
  let mockService;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    mockService = {
      meuMetodo: jest.fn()
    };

    controller = new MeuController(mockService);
    app.post('/api/v1/recurso', (req, res) => controller.create(req, res));
  });

  it('deve retornar status correto para requisição válida', async () => {
    // Arrange
    const dados = { /* payload */ };
    mockService.meuMetodo.mockResolvedValue({ /* resposta */ });

    // Act
    const response = await request(app)
      .post('/api/v1/recurso')
      .send(dados)
      .expect(201);

    // Assert
    expect(response.body).toMatchObject({ /* estrutura esperada */ });
  });
});
```

---

## 🎯 Boas Práticas Aplicadas

### 1. Padrão AAA (Arrange-Act-Assert)

```javascript
it('exemplo do padrão AAA', () => {
  // Arrange - Preparar tudo que é necessário
  const entrada = { /* dados */ };
  
  // Act - Executar a ação a ser testada
  const resultado = funcao(entrada);
  
  // Assert - Verificar se o resultado é o esperado
  expect(resultado).toBe(esperado);
});
```

### 2. Testes Independentes

✅ **BOM:**
```javascript
beforeEach(() => {
  // Criar nova instância para cada teste
  instancia = new MinhaClasse();
});
```

❌ **RUIM:**
```javascript
// Compartilhar instância entre testes
const instancia = new MinhaClasse(); // NÃO FAZER ISSO!
```

### 3. Nomes Descritivos

✅ **BOM:**
```javascript
it('deve retornar erro 400 quando nome não for fornecido', () => { });
```

❌ **RUIM:**
```javascript
it('teste de erro', () => { });
```

### 4. Testar Casos de Sucesso E Falha

```javascript
describe('cadastrarNovo', () => {
  // Caso de sucesso
  it('deve cadastrar com dados válidos', () => { });
  
  // Casos de falha
  it('deve falhar sem nome', () => { });
  it('deve falhar sem dosagem', () => { });
  it('deve falhar com dosagem negativa', () => { });
});
```

---

## 🔍 Matchers Úteis do Jest

```javascript
// Igualdade
expect(valor).toBe(esperado);              // Igualdade estrita (===)
expect(valor).toEqual(esperado);           // Igualdade profunda (objetos)

// Verdadeiro/Falso
expect(valor).toBeTruthy();                // Valor truthy
expect(valor).toBeFalsy();                 // Valor falsy
expect(valor).toBeNull();                  // Exatamente null
expect(valor).toBeUndefined();             // Exatamente undefined
expect(valor).toBeDefined();               // Não undefined

// Números
expect(numero).toBeGreaterThan(3);         // Maior que
expect(numero).toBeGreaterThanOrEqual(3);  // Maior ou igual
expect(numero).toBeLessThan(5);            // Menor que
expect(numero).toBeCloseTo(0.3);           // Aproximadamente igual

// Strings
expect(string).toMatch(/pattern/);         // Corresponde a regex
expect(string).toContain('substring');     // Contém substring

// Arrays
expect(array).toContain(item);             // Contém item
expect(array).toHaveLength(3);             // Tamanho do array

// Objetos
expect(objeto).toHaveProperty('key');      // Tem propriedade
expect(objeto).toMatchObject({ a: 1 });    // Corresponde parcialmente

// Funções
expect(fn).toHaveBeenCalled();             // Foi chamada
expect(fn).toHaveBeenCalledTimes(2);       // Chamada N vezes
expect(fn).toHaveBeenCalledWith(arg);      // Chamada com argumentos

// Promises
await expect(promise).resolves.toBe(valor);    // Resolve com valor
await expect(promise).rejects.toThrow(erro);   // Rejeita com erro

// Tipos
expect(valor).toBeInstanceOf(Classe);      // Instância de classe
```

---

## 📚 Recursos Adicionais

- [Documentação do Jest](https://jestjs.io/docs/getting-started)
- [Documentação do Supertest](https://github.com/visionmedia/supertest)
- [Jest Cheat Sheet](https://github.com/sapegin/jest-cheat-sheet)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

## 💡 Dicas Finais

1. **Escreva testes legíveis** - Outro desenvolvedor deve entender o teste sem olhar a implementação
2. **Teste comportamentos, não implementação** - Se refatorar o código, os testes devem continuar passando
3. **Mantenha testes rápidos** - Use mocks para dependências externas
4. **Um assert por conceito** - Cada teste deve verificar uma coisa específica
5. **Não teste código de terceiros** - Confie que frameworks funcionam, teste seu código


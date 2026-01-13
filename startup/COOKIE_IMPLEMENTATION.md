# Implementação de Cookies HttpOnly - Guia de Instalação

## ✅ Mudanças Implementadas

### Backend

1. **Cookie HttpOnly no Login** (`backend/src/infrastructure/web/controllers/login.controller.ts`)
   - Token agora é enviado em cookie HttpOnly
   - Configuração para HTTP (sem flag Secure)
   - `SameSite=Lax` para proteção CSRF

2. **Middleware de Autenticação Atualizado** (`backend/src/middleware/auth.middleware.ts`)
   - Lê token do cookie HttpOnly (prioridade)
   - Fallback para header Authorization (compatibilidade)

3. **Logout Limpa Cookie** (`backend/src/infrastructure/web/controllers/login.controller.ts`)
   - Cookie é limpo no logout

4. **Cookie Parser Adicionado** (`backend/src/infrastructure/web/main.ts`)
   - Middleware `cookie-parser` necessário para ler cookies

### Frontend

1. **API Client Atualizado** (`frontend/client/api/canonical.ts`)
   - `credentials: 'include'` para enviar cookies
   - Removido uso de sessionStorage para token

2. **Auth Context Atualizado** (`frontend/client/context/auth-context.tsx`)
   - Removido armazenamento de token em sessionStorage
   - Apenas user é armazenado (token em cookie HttpOnly)

3. **Auth Helper Atualizado** (`frontend/client/helpers/auth.helper.ts`)
   - Funções de token removidas (não acessíveis via JavaScript)

## 📦 Instalação Necessária

### Backend

Execute no diretório `backend`:

```bash
cd backend
npm install cookie-parser @types/cookie-parser
```

## 🔒 Configuração de Cookies

### Características dos Cookies Implementados:

- **HttpOnly: true** - Previne acesso via JavaScript (proteção XSS)
- **SameSite: 'lax'** - Proteção CSRF (funciona melhor que Strict em HTTP)
- **maxAge: 24 horas** - Expiração do token
- **path: '/'** - Disponível em todo o domínio
- **Sem flag Secure** - Compatível com HTTP (não requer HTTPS)

### Por que não usar Secure?

O sistema roda em HTTP (localhost), então a flag `Secure` não pode ser usada (requer HTTPS). Mesmo sem Secure, o HttpOnly ainda oferece proteção significativa contra XSS.

## 🧪 Como Testar

### 1. Verificar Cookie no DevTools

1. Faça login no sistema
2. Abra DevTools > Application > Cookies
3. Verifique que existe um cookie `authToken`
4. **IMPORTANTE:** Tente acessar `document.cookie` no console - o cookie HttpOnly NÃO deve aparecer

### 2. Verificar Requisições

1. Abra DevTools > Network
2. Faça uma requisição autenticada
3. Verifique que o cookie é enviado automaticamente no header `Cookie`
4. O token NÃO deve aparecer no header `Authorization` (a menos que seja fallback)

### 3. Testar XSS Protection

1. Tente executar no console do navegador:
   ```javascript
   document.cookie
   ```
2. O cookie `authToken` NÃO deve aparecer (proteção HttpOnly funcionando)

### 4. Testar Logout

1. Faça logout
2. Verifique que o cookie `authToken` foi removido
3. Tente fazer uma requisição autenticada - deve retornar 401

## ⚠️ Compatibilidade

### Fallback para Header Authorization

O sistema ainda aceita token no header `Authorization: Bearer <token>` como fallback para compatibilidade. Isso permite:

- Testes com ferramentas como Postman
- Migração gradual
- Compatibilidade com sistemas legados

**Recomendação:** Em produção, considere remover o fallback após validação completa.

## 🔍 Verificação de Segurança

### ✅ Proteções Implementadas:

1. **XSS Protection** - Token não acessível via JavaScript
2. **CSRF Protection** - SameSite=Lax previne alguns ataques CSRF
3. **Token não exposto** - Não aparece em sessionStorage ou localStorage
4. **Limpeza automática** - Cookie limpo no logout

### ⚠️ Limitações em HTTP:

1. **Sem flag Secure** - Cookie pode ser interceptado em rede (menos crítico em localhost)
2. **Sem HSTS** - Não pode usar HTTP Strict Transport Security
3. **Interceptação possível** - Ferramentas como Burp Suite ainda podem ver o cookie

### 🎯 Melhorias Futuras (se migrar para HTTPS):

1. Adicionar flag `Secure` aos cookies
2. Implementar HSTS
3. Considerar refresh tokens
4. Implementar rotação de tokens

## 📝 Notas Importantes

1. **CORS deve permitir credentials:**
   - Backend já está configurado com `Access-Control-Allow-Credentials: true`
   - Frontend usa `credentials: 'include'` nas requisições

2. **Cookie não aparece em sessionStorage:**
   - Isso é esperado e desejado (segurança)
   - Apenas o objeto `user` fica em sessionStorage

3. **Token não retornado no body:**
   - Resposta de login agora retorna apenas `{ user: {...} }`
   - Token está apenas no cookie HttpOnly

## 🐛 Troubleshooting

### Cookie não está sendo enviado

1. Verifique se `credentials: 'include'` está nas requisições
2. Verifique CORS no backend (`Access-Control-Allow-Credentials: true`)
3. Verifique se o cookie foi criado (DevTools > Application > Cookies)

### Erro 401 após login

1. Verifique se `cookie-parser` está instalado no backend
2. Verifique se o middleware está configurado em `main.ts`
3. Verifique logs do backend para erros

### Cookie não é limpo no logout

1. Verifique se `res.clearCookie()` está sendo chamado
2. Verifique se as opções do `clearCookie` correspondem às do `setCookie`




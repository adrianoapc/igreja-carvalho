# Investigação: Problema do Refresh Token Inválido

## Resumo do Problema

Ao fazer login via email/password, Supabase retorna um `refresh_token` com apenas **12 caracteres** (ex: `jljgvgeud4yz`) em vez de um JWT válido (100+ caracteres).

**Exemplos dos logs:**
- Timestamp 1765507011: `refresh_token: "jljgvgeud4yz"` ❌ INVÁLIDO (12 chars)
- access_token: JWT válido ✅ (200+ chars)

## Diagnóstico

### O que funciona:
- ✅ Login com email/password (status 200)
- ✅ GET /user endpoint
- ✅ Logout
- ✅ Access token é sempre válido

### O que falha:
- ❌ Usar refresh_token para renovar sessão
- ❌ Erro: `"400: Invalid Refresh Token: Refresh Token Not Found"`
- ❌ Refresh token tem tamanho muito pequeno

## Causas Potenciais

### 1. **Problema de Configuração Supabase**
   - JWT signing key incorreta ou não configurada
   - Supabase schema/policies com erro
   - Tokens gerados por instância de Supabase diferente

### 2. **Instância Local vs. Cloud**
   - Se usando `supabase start` localmente:
     - Verificar se containers estão rodando
     - Resetar com `supabase stop && supabase start`
     - Valores de chave podem estar corrompidos

### 3. **Versão Incompatível**
   - @supabase/supabase-js: v2.86.0 pode ter comportamento diferente
   - Verificar release notes para breaking changes

## Passos para Investigação

### Passo 1: Verificar Instância Supabase

```bash
# Se usando local:
supabase status

# Deve mostrar:
# - API URL: http://localhost:54321
# - Postgres: http://localhost:5432
# - Anonymous Key: eyJh...
# - Service Role Key: eyJh...
```

### Passo 2: Verificar Database Policies

```sql
-- Executar no Supabase SQL Editor
SELECT * FROM auth.users LIMIT 1;
-- Verificar se usuário foi criado corretamente
```

### Passo 3: Testar Token Diretamente

```bash
# Login
curl -X POST http://localhost:54321/auth/v1/token \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "grant_type": "password"
  }'

# Resposta deve incluir:
# - refresh_token: "eyJh..." (JWT válido, 100+ chars)
# - access_token: "eyJh..."
```

### Passo 4: Verificar Variáveis de Ambiente

Em `.env.local`:
```
VITE_SUPABASE_URL=https://mcomwaelbwvyotvudnzt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

Se usando local:
```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=eyJh... (anonymous key local)
```

## Solução Implementada

### Fallback com Access Token ✅
- Quando refresh_token inválido, usar access_token como fallback
- `supabase.auth.setSession({ access_token, refresh_token })`
- Permite biometric login funcionar mesmo com refresh token corrompido

### Validação de Token
```typescript
// Rejeitar tokens < 50 caracteres
if (refreshToken.length > 50) {
  saveRefreshToken(refreshToken);
}
```

## Próximas Ações

1. **Teste Local** (se aplicável)
   - Executar `supabase reset` para limpar dados
   - Fazer novo login e verificar token

2. **Verificar Cloud Supabase**
   - Dashboard → Authentication → Users
   - Verificar se usuário tem refresh token válido

3. **Contatar Supabase Support**
   - Se problema persiste
   - Fornecer Project ID: `mcomwaelbwvyotvudnzt`
   - Compartilhar logs de erro

4. **Upgrade de Dependências**
   - Testar com versão mais recente de `@supabase/supabase-js`

## Arquivos Afetados

- `src/hooks/useBiometricAuth.tsx` - Adicionado suporte para access_token
- `src/hooks/useAuthDiagnostics.tsx` - Novo hook para diagnóstico
- `src/pages/Auth.tsx` - Salva ambos tokens (refresh + access)
- `src/pages/BiometricLogin.tsx` - Usa fallback com access_token

## Como Testar o Fallback

1. Fazer login normal via email
2. Abrir DevTools → Application → Storage → localStorage
3. Verificar se `biometric_access_token` tem um JWT válido
4. Fechar tab/browser e tentar biometric login
5. Deve funcionar com fallback mesmo que refresh_token seja inválido

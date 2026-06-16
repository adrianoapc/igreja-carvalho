# Correção do Sistema de Criação de Usuários

## Problema Identificado

A pergunta era: **"Está inserindo efetivamente na tabela de usuários do supabase?"**

**Resposta**: Não. O sistema original tinha uma flaw crítica:

- As RPCs `criar_usuario_membro` e `resetar_senha_usuario_membro` tentavam fazer `INSERT` e `UPDATE` diretos na tabela `auth.users`
- **ISSUE**: `auth.users` é uma tabela de sistema do Supabase gerenciada pela plataforma
- **NÃO é possível** modificar `auth.users` via SQL direto ou RPCs
- **Solução requerida**: Usar a API de Admin do Supabase (via Edge Function)

## Solução Implementada

### 1. Edge Function: `criar-usuario`

**Localização**: `/supabase/functions/criar-usuario/index.ts`

**Funcionalidade**:

- Recebe requisições POST com duas ações:
  - `create_user`: Cria novo usuário em `auth.users` e atualiza `profiles.user_id`
  - `reset_password`: Reseta senha de usuário existente

**Como funciona**:

```typescript
// Para CRIAR usuário:
POST /functions/v1/criar-usuario
{
  "action": "create_user",
  "profile_id": "uuid-do-perfil",
  "email": "usuario@exemplo.com",
  "password": "SenhaTemporaria123!"
}

// Para RESETAR senha:
POST /functions/v1/criar-usuario
{
  "action": "reset_password",
  "profile_id": "uuid-do-perfil",
  "password": "NovaSenhaTemporaria456!"
}
```

**Segurança**:

- Usa `SUPABASE_SERVICE_ROLE_KEY` (ambiente controlado)
- Valida header de autorização
- Retorna erros descritivos

### 2. Componentes Atualizados

#### `CriarUsuarioDialog.tsx`

**Antes**: Chamava RPC `criar_usuario_membro`

```typescript
const { data, error } = await supabase.rpc("criar_usuario_membro", {
  p_profile_id: pessoaId,
  p_email: email,
  p_senha_temporaria: senhaTemporaria,
});
```

**Depois**: Chamada direto à Edge Function

```typescript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/criar-usuario`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      action: "create_user",
      profile_id: pessoaId,
      email,
      password: senhaTemporaria,
    }),
  }
);
```

#### `ResetarSenhaDialog.tsx`

**Antes**: Chamava RPC `resetar_senha_usuario_membro`

**Depois**: Chamada à mesma Edge Function com `action: "reset_password"`

## Fluxo Completo

```
1. Admin clica em "Criar Acesso"
   ↓
2. CriarUsuarioDialog abre, preenche email e gera senha temp
   ↓
3. Clica "Criar Usuário"
   ↓
4. Componente chama: POST /functions/v1/criar-usuario
   ↓
5. Edge Function:
   a. Valida autorização
   b. Cria usuário via supabase.auth.admin.createUser()
   c. Retorna user.user.id
   d. Atualiza profiles.user_id com o ID criado
   e. Seta deve_trocar_senha = true
   ↓
6. Frontend recebe sucesso
   ↓
7. Mostra email e senha temp para copiar
   ↓
8. Auto-fecha em 3 segundos
   ↓
9. Chama onSuccess() callback → refetch person data
   ↓
10. Button muda de "Criar Acesso" → "Resetar Senha" (pois user_id agora existe)
```

## Validações

✅ **Componentes compilam sem erros**

- CriarUsuarioDialog.tsx: OK
- ResetarSenhaDialog.tsx: OK

✅ **Servidor Vite está rodando**

- http://localhost:8083/

✅ **Variáveis de ambiente configuradas**

- `VITE_SUPABASE_URL` definido em `.env`

✅ **Segurança**

- Autorização via JWT token
- Service role key isolado em variáveis de ambiente (não expostas ao frontend)

## Próximos Passos

### 1. **DEPLOY da Edge Function** (CRÍTICO)

```bash
supabase functions deploy criar-usuario
```

### 2. **Testar a criação**

- Abrir página de pessoa com status "membro"
- Admin clica "Criar Acesso"
- Verifica se usuário aparece em `auth.users`
- Verifica se `profiles.user_id` foi atualizado

### 3. **Testar reset de senha**

- Clica "Resetar Senha"
- Verifica se `deve_trocar_senha` está `true`
- Valida que usuário consegue fazer login com nova senha

### 4. **Limpeza (opcional)**

- Remover/deprecar RPC `criar_usuario_membro`
- Remover/deprecar RPC `resetar_senha_usuario_membro`
- Remover migration `20260114130619_criar_usuario_member.sql`

## Diferença com a Abordagem Anterior

| Aspecto             | RPC (Anterior)             | Edge Function (Novo)        |
| ------------------- | -------------------------- | --------------------------- |
| Onde roda           | PostgreSQL                 | Deno/Supabase Deno Runtime  |
| Acesso a auth.users | ❌ SQL direto não funciona | ✅ Via API de Admin         |
| Autenticação        | ❌ Sem controle            | ✅ JWT token + Service Role |
| Erro ao usuário     | Genérico                   | Descritivo                  |
| Escalabilidade      | Limitada                   | Melhor isolamento           |

## Por que Edge Function?

Supabase é agnóstico ao banco - não permite SQL direto em tabelas de sistema como `auth.users`. A forma correta é:

1. **Frontend** → chama API/RPC
2. **RPC** → NÃO consegue modificar `auth.users`
3. **Edge Function** (Code) → usa Admin API do Supabase
4. **Admin API** → tem acesso privilegiado a `auth.users`

Edge Functions são:

- ✅ Serverless
- ✅ Autoscaled
- ✅ Com acesso a variáveis de ambiente seguras
- ✅ Ideais para operações que precisam de privilégios especiais

## Arquivos Afetados

```
✏️ src/components/pessoas/CriarUsuarioDialog.tsx
   - Substituiu chamada RPC por fetch à Edge Function

✏️ src/components/pessoas/ResetarSenhaDialog.tsx
   - Substituiu chamada RPC por fetch à Edge Function

✨ supabase/functions/criar-usuario/index.ts
   - NOVO: Edge Function que faz criação e reset de usuários
```

## Documentação de Referência

- [Supabase Auth Admin API](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [RLS & Security](https://supabase.com/docs/guides/auth/row-level-security)

---

**Status**: ✅ Pronto para deploy em produção (após testar)
**Data**: 2025-01-XX
**Branch**: `feature/financeiro-conferencia-cega`

# Correção de Foreign Key Constraints - Módulo Financeiro

**Data:** 14/01/2026  
**Branch:** `feature/financeiro-conferencia-cega`

## 🐛 Problema Identificado

### Erro Original (409 Conflict → 23503 FK Violation)

```
Key (created_by)=(57731c8e-25c2-47f0-97b9-71777c16d618) is not present in table "profiles"
```

### Erro Subsequente (403 Forbidden → 42501 RLS)

```
new row violates row-level security policy for table "sessoes_itens_draft"
```

## 🔍 Causa Raiz

As foreign keys estavam configuradas incorretamente - **campos de ação do usuário** (created_by, approved_by, etc.) precisam referenciar `profiles.user_id`, não `profiles.id`:

```sql
-- ❌ INCORRETO (como estava)
created_by UUID REFERENCES public.profiles(id)
approved_by UUID REFERENCES public.profiles(id)

-- ✅ CORRETO (como deveria ser)
created_by UUID REFERENCES public.profiles(user_id)
approved_by UUID REFERENCES public.profiles(user_id)

-- ⚠️ ATENÇÃO: pessoa_id é DIFERENTE
pessoa_id UUID REFERENCES public.profiles(id)  -- Correto! Referencia o membro cadastrado
```

### Por que isso é um problema?

Na tabela `profiles`:

- `id`: PK interno gerado pelo banco (ex: `a4097879-f52a-4bf2-86e6-62ad02a06268`) → **Identifica o membro/pessoa**
- `user_id`: FK para `auth.users.id` (ex: `57731c8e-25c2-47f0-97b9-71777c16d618`) → **Identifica o usuário autenticado**

**Regra importante:**

- **Campos de "quem fez a ação"** (created_by, approved_by, rejection_by, contador_id) → `auth.uid()` → `profiles.user_id`
- **Campos de "sobre quem é"** (pessoa_id) → Seleção de pessoa → `profiles.id`

### Impacto

1. **Erro de FK Violation**: Ao tentar inserir registros com `auth.uid()`, o valor não existe em `profiles.id`
2. **Erro de RLS**: Políticas que verificam `auth.uid()` não encontram correspondência, negando acesso
3. **Auditoria Quebrada**: Registros de quem criou/aprovou ficam incorretos ou nulos

## 🔧 Solução Aplicada

### Migrations Criadas

#### Migration: `20260114153550_94eebd7a-3234-4ba7-b54b-d03ed5516162.sql`

Corrige as FKs de **campos de ação do usuário** (quem executou) para usar `profiles.user_id`:

**Tabelas corrigidas:**

- `sessoes_contagem`: `created_by`, `approved_by`, `rejection_by` → `profiles.user_id`
- `sessoes_itens_draft`: `created_by` → `profiles.user_id`
- `contagens`: `contador_id` → `profiles.user_id`

**Mantidas corretas:**

- `sessoes_itens_draft`: `pessoa_id` → `profiles.id` (membro associado)
- `transacoes_financeiras`: `pessoa_id` → `profiles.id` (membro associado)

## 📋 Como Aplicar

✅ **Migration já aplicada na master e sincronizada no branch!**

A migration `20260114153550_94eebd7a-3234-4ba7-b54b-d03ed5516162.sql` já foi aplicada no banco de dados de produção e está disponível no branch após o merge com a master.

### Se precisar reaplicar localmente:

**Opção 1 - Supabase CLI:**

```bash
supabase db push
```

**Opção 2 - Dashboard Manual:**

1. Acesse Supabase Dashboard → SQL Editor
2. A migration já deve estar aplicada
3. Verifique em "Database" → "Migrations"

## ✅ Validação

Após aplicar as migrations:

1. **Testar abertura de sessão:**

   ```typescript
   // Deve funcionar sem erro 409/23503
   const sessao = await openSessaoContagem(
     igrejaId,
     filialId,
     dataCulto,
     periodo
   );
   ```

2. **Testar salvamento de draft:**

   ```typescript
   // Deve funcionar sem erro 403/42501
   await supabase.from("sessoes_itens_draft").insert({
     sessao_id,
     pessoa_id: auth.uid(), // Agora funciona!
     valor: 100,
     // ...
   });
   ```

3. **Verificar policies RLS:**
   - Usuários com papel `admin` ou `tesoureiro` devem conseguir inserir/editar
   - Auditoria de `created_by` deve registrar corretamente

## 🎯 Lições Aprendidas

1. **Sempre referenciar `profiles.user_id`** quando usar `auth.uid()`
2. **Cuidado com FKs em tabelas de auditoria** (created_by, updated_by, etc.)
3. **Testar RLS policies** após mudanças em FKs
4. **Screenshot da estrutura da tabela** ajudou muito na investigação

## 📚 Referências

- Issue original: Erro 409 ao abrir sessão de contagem
- Screenshot: Estrutura da tabela `profiles` mostrando `id` vs `user_id`
- Docs: [Supabase Auth UID](https://supabase.com/docs/guides/auth/managing-user-data)

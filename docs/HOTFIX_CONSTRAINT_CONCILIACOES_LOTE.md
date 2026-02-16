# Correção: Constraint UNIQUE em conciliacoes_lote_extratos

## Problema Identificado

**Erro:** `duplicate key value violates unique constraint "conciliacoes_lote_extratos_extrato_id_key"`

**Contexto:** Ao conciliar 1 extrato com múltiplas transações (caso 1:N), o sistema tentava criar N lotes (um por transação) e vincular o mesmo extrato a todos eles, violando a constraint `UNIQUE(extrato_id)`.

## Comportamento Problemático

1. Usuário seleciona 1 extrato + 2 transações
2. Sistema cria 2 registros em `conciliacoes_lote` (correto)
3. Sistema tenta criar 2 registros em `conciliacoes_lote_extratos` com o mesmo `extrato_id`
4. ❌ Constraint `UNIQUE(extrato_id)` bloqueia o segundo insert
5. Extrato fica marcado como `reconciliado=true` mas sem vínculos completos

## Causa Raiz

A constraint `UNIQUE(extrato_id)` na tabela `conciliacoes_lote_extratos` foi criada com a premissa incorreta de que "um extrato só pode estar em um lote". Isso funciona para:
- ✅ Caso 1:1 (1 extrato : 1 transação via `transacao_vinculada_id`)
- ❌ Caso 1:N (1 extrato : N transações via lotes)

## Solução Implementada

### 1. Migration SQL (`20260215170000_fix_conciliacoes_lote_extratos_constraint.sql`)

```sql
-- Remover constraint antiga
ALTER TABLE public.conciliacoes_lote_extratos 
DROP CONSTRAINT IF EXISTS conciliacoes_lote_extratos_extrato_id_key;

-- Adicionar constraint composta
ALTER TABLE public.conciliacoes_lote_extratos 
ADD CONSTRAINT conciliacoes_lote_extratos_lote_extrato_key 
UNIQUE (conciliacao_lote_id, extrato_id);
```

**Nova semântica:**
- ✅ Um extrato pode aparecer em múltiplos lotes
- ✅ Previne duplicação: mesmo lote não pode ter o mesmo extrato 2x
- ✅ Suporta caso 1:N corretamente

### 2. Código TypeScript (`ConciliacaoInteligente.tsx`)

**Mudanças principais:**

1. **Ordem de execução corrigida:**
   - ✅ Criar lotes primeiro (batch)
   - ✅ Vincular extratos (batch)
   - ✅ Marcar extrato como reconciliado (só depois de tudo OK)
   - ✅ Atualizar transações

2. **Rollback em caso de erro:**
   ```typescript
   try {
     // ... operações de conciliação
   } catch (error) {
     // Rollback: desmarcar extrato
     await supabase
       .from('extratos_bancarios')
       .update({ reconciliado: false })
       .eq('id', extratoId)
     throw error
   }
   ```

3. **Operações em batch:**
   - Antes: Loop sequencial (N queries)
   - Depois: Insert em batch (2 queries apenas)

## Casos de Uso Suportados

### Caso 1:1 (Direto)
- Extrato → `transacao_vinculada_id` → Transação
- Tabela: `extratos_bancarios`
- Constraint: OK

### Caso 1:N (Lote)
- 1 Extrato → N Lotes → N Transações
- Tabelas: `conciliacoes_lote` + `conciliacoes_lote_extratos`
- Constraint: ✅ Corrigida

### Caso N:1 (Lote)
- N Extratos → 1 Lote → 1 Transação
- Tabelas: `conciliacoes_lote` + `conciliacoes_lote_extratos`
- Constraint: ✅ OK (já funcionava)

## Validação

1. ✅ Build passa sem erros
2. ✅ Migration criada e documentada
3. ✅ Rollback implementado em caso de falha
4. ✅ Batch operations para performance

## Próximos Passos

1. Aplicar migration no ambiente de produção
2. Testar caso 1:N com múltiplas transações
3. Verificar se há registros órfãos no banco (extrato reconciliado sem vínculos)

## Referências

- Migration: `supabase/migrations/20260215170000_fix_conciliacoes_lote_extratos_constraint.sql`
- Código: `src/components/financas/ConciliacaoInteligente.tsx` (linhas 467-547)
- Issue: Erro 409 Conflict ao conciliar 1 extrato com 2+ transações

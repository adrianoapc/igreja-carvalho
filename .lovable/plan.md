
# Plano: Adicionar Validação de `requer_inscricao` no `inscricao-compartilhe`

## Problema Identificado

| Edge Function | Valida `requer_inscricao`? | Status |
|---------------|---------------------------|--------|
| `chatbot-triagem` | ✅ Sim (linha 200) | OK |
| `inscricao-compartilhe` | ❌ Não | **Precisa corrigir** |

A função `inscricao-compartilhe` filtra eventos apenas pelo subtipo "Ação Social", mas não verifica se o evento realmente requer inscrição. Isso pode causar:
- Inscrições em eventos que não deveriam ter inscrições
- Comportamento inconsistente entre os dois canais de inscrição

---

## Solução

Adicionar `.eq("requer_inscricao", true)` na query de eventos em `inscricao-compartilhe`.

---

## Alteração no Arquivo

**Arquivo:** `supabase/functions/inscricao-compartilhe/index.ts`

**Linhas 296-306** - Adicionar filtro:

```typescript
let eventoQuery = supabase
  .from("eventos")
  .select(
    "id, titulo, data_evento, status, requer_pagamento, valor_inscricao, vagas_limite, inscricoes_abertas_ate, igreja_id"
  )
  .eq("igreja_id", igrejaId)
  .eq("subtipo_id", subtipo.id)
  .eq("status", "confirmado")
  .eq("requer_inscricao", true)  // ✅ ADICIONAR ESTA LINHA
  .gte("data_evento", agoraIso)
  .order("data_evento", { ascending: true })
  .limit(1);
```

---

## Resumo

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/inscricao-compartilhe/index.ts` | Adicionar `.eq("requer_inscricao", true)` na query (linha 303) |

---

## Benefício

- Garante consistência entre os dois canais de inscrição (chatbot-triagem e inscricao-compartilhe)
- Previne inscrições em eventos que não estão configurados para aceitar inscrições
- Evita erros silenciosos quando um evento de "Ação Social" não tem `requer_inscricao` habilitado

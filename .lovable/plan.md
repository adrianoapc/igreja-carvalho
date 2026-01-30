
# Correção: Adicionar `fornecedor_id` e `base_ministerial_id` no Reembolso

## Diagnóstico

O chatbot financeiro **processa** corretamente o fornecedor via OCR e armazena em `item.fornecedor_id`, mas esse dado **não está sendo salvo** na tabela `itens_reembolso`.

| Campo | Fluxo Despesa | Fluxo Reembolso |
|-------|---------------|-----------------|
| `fornecedor_id` | ✅ Salva | ❌ **Não salva** |
| `base_ministerial_id` | ✅ Salva | ❌ **Não salva** |
| `categoria_id` | ✅ Salva | ✅ Salva |
| `subcategoria_id` | ✅ Salva | ✅ Salva |
| `centro_custo_id` | ✅ Salva | ✅ Salva |

---

## Correção Necessária

### Arquivo: `supabase/functions/chatbot-financeiro/index.ts`

Adicionar os campos faltantes no INSERT de `itens_reembolso` (linhas 1384-1397):

```typescript
const { data: itemReembolso, error: itemError } = await supabase
  .from("itens_reembolso")
  .insert({
    solicitacao_id: solicitacao.id,
    descricao: descricaoItem,
    valor: item.valor || 0,
    data_item: dataItem,
    categoria_id: item.categoria_sugerida_id,
    subcategoria_id: item.subcategoria_sugerida_id,
    centro_custo_id: item.centro_custo_sugerido_id,
    foto_url: item.anexo_storage,
    igreja_id: igrejaId,
    filial_id: filialIdFromWhatsApp,
    fornecedor_id: item.fornecedor_id,                    // ← ADICIONAR
    base_ministerial_id: item.base_ministerial_sugerido_id, // ← ADICIONAR
  })
  .select("id")
  .single();
```

---

## Resultado

Após a correção:
- ✅ Fornecedor será vinculado ao item de reembolso
- ✅ Base ministerial será vinculada (para relatórios por ministério)
- ✅ Mesma qualidade de dados do fluxo de despesas

---

## Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/chatbot-financeiro/index.ts` | Adicionar `fornecedor_id` e `base_ministerial_id` no INSERT |

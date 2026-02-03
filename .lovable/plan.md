
# Plano: Melhorar Sugestões de Transações no Vincular

## Problemas Identificados

### 1. Transações Já Vinculadas Aparecendo como Sugestão
Atualmente, a lista `transacoesDisponiveis` passada para o `VincularTransacaoDialog` inclui todas as transações do período, mesmo aquelas que já estão vinculadas a outros extratos. Isso polui a lista e pode causar confusão.

### 2. Filtro de Mês Rígido
Se o usuário está com o MonthPicker em janeiro, mas a despesa (reembolso) foi lançada em dezembro, essa transação não aparecerá como opção. O sistema precisa de uma janela mais flexível ou indicar claramente o período atual.

---

## Soluções Propostas

### Solução 1: Excluir Transações Já Vinculadas

**Alteração em `ConciliacaoManual.tsx` e `DashboardConciliacao.tsx`:**

Antes de passar `transacoesDisponiveis` para o dialog, filtrar as transações que já possuem vínculo com algum extrato:

```typescript
// Buscar IDs de transações já vinculadas
const { data: vinculadas } = useQuery({
  queryKey: ["transacoes-vinculadas", igrejaId],
  queryFn: async () => {
    const { data } = await supabase
      .from("extratos_bancarios")
      .select("transacao_vinculada_id")
      .not("transacao_vinculada_id", "is", null);
    return new Set(data?.map(e => e.transacao_vinculada_id) || []);
  },
});

// Ao passar para o dialog:
transacoesDisponiveis={(transacoes || []).filter(t => !vinculadas?.has(t.id))}
```

### Solução 2: Expandir Janela de Busca no VincularTransacaoDialog

**Modificar `VincularTransacaoDialog.tsx`:**

Adicionar um indicador visual do período filtrado e uma opção para buscar em período mais amplo:

1. Mostrar badge com o período atual: `"Jan 2026"`
2. Adicionar botão "Buscar em todos os períodos" que amplia a janela de busca
3. Ou: Buscar automaticamente ±30 dias da data do extrato sendo vinculado

### Alternativa Mais Simples (Recomendada)

O dialog `VincularTransacaoDialog` pode buscar suas próprias transações com uma janela flexível baseada na data do extrato:

```typescript
// Dentro do VincularTransacaoDialog, buscar transações ±60 dias do extrato
const dataExtrato = parseISO(extrato.data_transacao);
const inicio = format(subDays(dataExtrato, 60), "yyyy-MM-dd");
const fim = format(addDays(dataExtrato, 60), "yyyy-MM-dd");
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `VincularTransacaoDialog.tsx` | Buscar transações próprias com janela flexível (+/- 60 dias) e excluir já vinculadas |
| `ConciliacaoManual.tsx` | Remover passagem de `transacoesDisponiveis` (agora buscado internamente) |
| `DashboardConciliacao.tsx` | Remover passagem de `transacoesDisponiveis` (agora buscado internamente) |

---

## Detalhes Técnicos

### Query Interna no VincularTransacaoDialog

```typescript
const { data: transacoesDisponiveis, isLoading } = useQuery({
  queryKey: ["transacoes-para-vincular", extrato.id, igrejaId],
  queryFn: async () => {
    // Janela de ±60 dias baseada no extrato
    const dataExtrato = parseISO(extrato.data_transacao);
    const dataInicio = format(subDays(dataExtrato, 60), "yyyy-MM-dd");
    const dataFim = format(addDays(dataExtrato, 60), "yyyy-MM-dd");

    // Buscar transações não vinculadas no período
    const { data: transacoes } = await supabase
      .from("transacoes_financeiras")
      .select(`id, descricao, valor, tipo, data_pagamento, 
               categorias_financeiras(nome)`)
      .eq("igreja_id", igrejaId)
      .eq("status", "pago")
      .gte("data_pagamento", dataInicio)
      .lte("data_pagamento", dataFim);

    // Buscar IDs já vinculados
    const { data: vinculados } = await supabase
      .from("extratos_bancarios")
      .select("transacao_vinculada_id")
      .not("transacao_vinculada_id", "is", null);

    const idsVinculados = new Set(
      vinculados?.map(e => e.transacao_vinculada_id) || []
    );

    // Filtrar transações disponíveis
    return transacoes?.filter(t => !idsVinculados.has(t.id)) || [];
  },
  enabled: open && !!igrejaId,
});
```

### Indicador Visual do Período

```tsx
<Badge variant="outline" className="text-xs">
  Buscando: {format(subDays(parseISO(extrato.data_transacao), 60), "dd/MM")} 
  a {format(addDays(parseISO(extrato.data_transacao), 60), "dd/MM/yyyy")}
</Badge>
```

---

## Resultado Esperado

1. **Sem duplicatas**: Transações já vinculadas a outros extratos não aparecem como sugestão
2. **Janela flexível**: Mesmo se o extrato for de janeiro, transações de dezembro/fevereiro aparecem
3. **Transparência**: Usuário vê claramente qual período está sendo buscado
4. **Independência**: O dialog não depende mais do período selecionado no MonthPicker da tela pai

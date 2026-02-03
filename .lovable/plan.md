

# Correção de Erros de Build + Teste de Reconciliação

## Erros Identificados

### Erro 1: `TransferenciaDialog.tsx:262`
**Problema:** Usa `subcategoriaDepositoEntrada` que não existe. Só foi definido `subcategoriaDepositoSaida`.

**Solução:** Criar query para buscar subcategoria de entrada OU usar a mesma subcategoria para ambos (null para entrada).

### Erro 2: `Contas.tsx:365`
**Problema:** Referência circular no tipo - `transacoes: typeof transacoes`.

```typescript
const filterByStatus = (transacoes: typeof transacoes) => { ... }
```

**Solução:** Alterar para receber um tipo concreto:

```typescript
const filterByStatus = (items: NonNullable<typeof transacoes>) => { ... }
```

### Erro 3: `Contas.tsx:523-526`
**Problema:** Tipo `data_vencimento` pode ser `Date | string | null` e está sendo usado como chave de objeto.

**Solução:** O tipo `TransacaoLista` já define `data_vencimento` como `string | Date | null`. O código na linha 522 tenta usar isso como índice. Precisamos garantir que sempre seja string:

```typescript
const data = typeof t.data_vencimento === 'string' 
  ? t.data_vencimento 
  : t.data_vencimento 
    ? t.data_vencimento.toISOString().split('T')[0] 
    : "sem-data";
```

---

## Arquivos a Modificar

| Arquivo | Linha | Correção |
|---------|-------|----------|
| `TransferenciaDialog.tsx` | 262 | Adicionar query para `subcategoriaDepositoEntrada` ou usar null |
| `Contas.tsx` | 365 | Corrigir tipo do parâmetro da função |
| `Contas.tsx` | 522-526 | Garantir que `data` seja sempre string |

---

## Após Correção: Teste de Reconciliação (Dezembro)

Após corrigir os erros de build, posso executar uma query para testar a reconciliação automática de dezembro:

```sql
SELECT * FROM reconciliar_transacoes(
  p_conta_id := 'UUID_CONTA',
  p_tolerancia_valor := 0.50,
  p_tolerancia_dias := 3
);
```

Ou verificar os dados do mês:

```sql
-- Extratos não reconciliados de dezembro
SELECT id, data_transacao, descricao, valor, tipo 
FROM extratos_bancarios 
WHERE reconciliado = false 
  AND data_transacao >= '2025-12-01' 
  AND data_transacao <= '2025-12-31'
ORDER BY data_transacao;

-- Transações de dezembro
SELECT id, data_pagamento, descricao, valor, tipo, status
FROM transacoes_financeiras 
WHERE data_pagamento >= '2025-12-01' 
  AND data_pagamento <= '2025-12-31'
  AND status = 'pago'
ORDER BY data_pagamento;
```

---

## Próximos Passos

1. **Corrigir os 3 erros de TypeScript**
2. **Testar a reconciliação de dezembro** via query SQL
3. **Validar funcionamento** na interface


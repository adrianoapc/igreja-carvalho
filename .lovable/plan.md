
# Diagnóstico e Correção: Transação de900f52 × Extrato 37a3adff

## O Problema

A transação **"Aluguel - Fase 2"** (`de900f52`) está marcada como `conciliado_extrato`, mas o extrato correspondente (`37a3adff` — "PAGAMENTO DE BOLETO OUTROS BANCOS - Adelicio, R$ 7.580,59") **não aparece como conciliado** na tela de conciliação.

## Causa Raiz: Lotes Duplicados + Status Pendente

O extrato `37a3adff` foi vinculado a **dois lotes** durante a mesma sessão de conciliação (provavelmente dois cliques ou duas tentativas):

| Lote ID | Transação Vinculada | Valor Transação | Status do Lote |
|---|---|---|---|
| `3cfdd7f4` | Aluguel - Fase 2 (sua transação) | R$ 7.500,00 | pendente |
| `2baedfd2` | IPTU | R$ 302,09 | pendente |

Fluxo do problema:

1. Usuário tentou conciliar o extrato com "Aluguel - Fase 2" -> Lote `3cfdd7f4` criado, extrato marcado `reconciliado = true`
2. Em seguida, o mesmo extrato foi vinculado ao "IPTU" no Lote `2baedfd2` (segunda tentativa/clique duplicado)
3. Ambos os lotes ficaram com `status = 'pendente'` — nenhum foi confirmado
4. Porém, as duas transações (`Aluguel` e `IPTU`) tiveram `conciliacao_status` atualizado para `conciliado_extrato` prematuramente
5. O extrato ficou com `reconciliado = true`, mas sem nenhum lote em status `conciliada`, o que o torna invisível na tela

## Solução: Limpeza Cirúrgica via SQL

A correção tem 4 etapas executadas em sequência:

### Etapa 1 — Remover os dois lotes duplicados da tabela de vínculos
```sql
DELETE FROM conciliacoes_lote_extratos
WHERE extrato_id = '37a3adff-7de8-4bb2-89be-f32049659b3b';
```

### Etapa 2 — Remover os dois lotes em si
```sql
DELETE FROM conciliacoes_lote
WHERE id IN (
  '3cfdd7f4-a709-4c9d-a774-eadd31925641',
  '2baedfd2-0460-4909-a498-4d306e8fef3b'
);
```

### Etapa 3 — Reverter o extrato para não conciliado
```sql
UPDATE extratos_bancarios
SET reconciliado = false,
    transacao_vinculada_id = NULL
WHERE id = '37a3adff-7de8-4bb2-89be-f32049659b3b';
```

### Etapa 4 — Reverter as duas transações para não conciliadas
```sql
UPDATE transacoes_financeiras
SET conciliacao_status = 'nao_conciliado'
WHERE id IN (
  'de900f52-e1b1-4a4e-a9cb-bbc4673c2b73',  -- Aluguel - Fase 2
  '15ddb56c-7213-4f01-96f8-978a9ce04dbd'   -- IPTU
);
```

## Resultado Esperado Após a Correção

- O extrato "PAGAMENTO DE BOLETO OUTROS BANCOS - Adelicio" (R$ 7.580,59) voltará a aparecer na lista de extratos disponíveis para conciliação
- A transação "Aluguel - Fase 2" (R$ 7.500,00) voltará a aparecer como disponível para conciliação
- A transação "IPTU" (R$ 302,09) voltará a aparecer como disponível para conciliação
- O usuário poderá refazer a conciliação corretamente, escolhendo o vínculo correto entre o extrato e a transação desejada

## Observação sobre Valores

O extrato é de **R$ 7.580,59** e a transação "Aluguel" é de **R$ 7.500,00** — há uma diferença de R$ 80,59. O sistema permite esta diferença no modo de lote (N:1). Confirme se este é mesmo o extrato correto para o aluguel antes de reconcilar novamente.

## Arquivos Afetados

Nenhum arquivo de código será alterado. Esta é uma correção exclusivamente de dados via migration SQL.

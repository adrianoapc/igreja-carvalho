
# Correção dos Erros de Build

São 6 grupos de erros independentes para corrigir, todos em arquivos frontend. Nenhuma mudança de banco ou edge function necessária.

---

## Resumo dos erros e correções

### 1. ConciliacaoInteligente.tsx — `setSortedTransacoes` não existe (linhas 1171-1172)

O código verifica `typeof setSortedTransacoes === "function"` mas essa variável nunca foi declarada no escopo. É um bloco morto que nunca seria executado de qualquer forma (a remoção da lista local já é feita via `setSelectedTransacoes` e `queryClient.invalidateQueries` na linha seguinte).

**Correção:** Remover as linhas 1171-1173 por completo.

---

### 2. SincronizacaoTransferenciasWidget.tsx — tipos errados nas linhas 44-45 e 69

O hook `useIgrejaId()` retorna `{ igrejaId, loading }` mas nas linhas 44-45 o código está passando o objeto inteiro onde deveria passar apenas as strings. Na linha 69, o cast de `resultado` para `SincronizacaoResultado` falha pois o tipo retornado pelo RPC é `Json`.

**Correção:**
- Linhas 44-45: O hook provavelmente está sendo desestruturado corretamente (linhas 28-29 mostram `const igrejaId = useIgrejaId()` e `const filialId = useFilialId()` sem desestruturação). Verificar como os hooks retornam os dados e ajustar o tipo de `igrejaId` e `filialId` para `string`.
- Linha 69: Trocar o cast direto por `resultado as unknown as SincronizacaoResultado`.

---

### 3. useConciliacaoLote.ts — `transferencia_id` não existe no tipo `Transacao` (linhas 243, 251)

A interface `Transacao` (definida na linha 21-29 do hook) não inclui `transferencia_id`. O campo existe na tabela mas não foi adicionado à interface local.

**Correção:** Adicionar `transferencia_id?: string | null` à interface `Transacao` do hook.

---

### 4. Dashboard.tsx — `FiltrosSheet` sem `conciliacaoStatus` e `setConciliacaoStatus` (linha 465)

O componente `FiltrosSheet` exige os props `conciliacaoStatus` e `setConciliacaoStatus` mas o Dashboard não os passa. O Dashboard usa o `FiltrosSheet` para filtrar apenas por mês/conta/categoria/status, sem filtro de conciliação.

**Correção:** Adicionar estado local `conciliacaoStatus` e `setConciliacaoStatus` no Dashboard e passá-los ao `FiltrosSheet` (ou tornar esses props opcionais no `FiltrosSheet`). A solução mais limpa é torná-los opcionais no `FiltrosSheetProps` com valor padrão `"all"` para não afetar o comportamento do Dashboard.

---

### 5. Entradas.tsx — `Transacao` incompatível com `TransacaoResumo` e `editingTransacao` (linhas 350, 1036, 1039, 1070)

Dois sub-problemas:

**5a.** `getStatusDisplay(t)` e `getStatusColorDynamic(t)` esperam `TransacaoResumo = { status, data_vencimento }`, mas `t` vem do query do Supabase que já inclui `data_vencimento`. O problema é que o tipo inferido do Supabase pode não incluir `data_vencimento` explicitamente no tipo TypeScript.

**5b.** `setEditingTransacao(transacao)` — o estado `editingTransacao` tem tipo `{ id, descricao, valor, status, data_vencimento }`, mas `transacao.valor` pode ser `number | null` no tipo inferido, e `data_vencimento` pode não estar presente no tipo.

**Correção:** 
- Na linha 310, ampliar `TransacaoResumo` para aceitar `data_vencimento?: string | Date | null`.
- No `setEditingTransacao`, fazer cast explícito: `setEditingTransacao({ id: transacao.id, descricao: transacao.descricao, valor: Number(transacao.valor), status: transacao.status, data_vencimento: transacao.data_vencimento ?? '' })`.

---

### 6. Saidas.tsx — Mesmos problemas de Entradas.tsx (linhas 481, 1022, 1025, 1066, 1220, 1223, 1253)

Idêntico ao item 5. Mesma correção aplicada ao `Saidas.tsx`.

---

## Arquivos afetados

| Arquivo | Linhas | Ação |
|---|---|---|
| `ConciliacaoInteligente.tsx` | 1171-1173 | Remover bloco morto com `setSortedTransacoes` |
| `SincronizacaoTransferenciasWidget.tsx` | 44-45, 69 | Corrigir tipos de `igrejaId`/`filialId` e cast de `resultado` |
| `useConciliacaoLote.ts` | 21-29 | Adicionar `transferencia_id?: string \| null` à interface `Transacao` |
| `FiltrosSheet.tsx` | 30-31 | Tornar `conciliacaoStatus` e `setConciliacaoStatus` opcionais |
| `Entradas.tsx` | 310, 1070 | Ampliar `TransacaoResumo` e ajustar `setEditingTransacao` |
| `Saidas.tsx` | 441, 1066, 1253 | Mesmas correções de Entradas.tsx |

---

## Observação sobre o erro santander-api (500)

O log mostra: `Authorization failed: Token inválido` — `missing sub claim`. Isso é um erro separado dos builds: a chamada ao `santander-api` está sendo feita sem um JWT de usuário autenticado válido (o token enviado é o anon key em vez do token de sessão do usuário). Isso não é um erro de código fonte mas sim de autenticação em tempo de execução — não será corrigido neste conjunto de builds.

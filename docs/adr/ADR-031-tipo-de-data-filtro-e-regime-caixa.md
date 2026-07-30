# ADR-031 — Tipo de Data (Vencimento/Pagamento) como eixo de filtro, e Regime de Caixa real no DRE

**Status:** Aceito
**Data:** 2026-07-29
**Decisores:** Tesouraria, Tecnologia
**Contexto:** Sistema Financeiro / Listagens (Entradas, Saídas, Dashboard, Contas, Insights, Exportação) / DRE

---

## 📌 Contexto

Toda tela de listagem do financeiro ("Período") filtrava silenciosamente
por `data_vencimento`, sem indicar isso na UI e sem opção de trocar. O
único lugar com um seletor "Regime" (Caixa/Competência) era o DRE
(`get_dre_anual`), mas mesmo lá o regime só filtrava `status` — sempre
agrupava por `data_competencia`, mesmo no regime de caixa. Referência de
mercado (inChurch): as listas de Entradas/Saídas expõem um dropdown "Tipo
de Data" (Vencimento vs Pagamento/Recebimento); relatórios separam
claramente Competência × Vencimento × Recebimento.

Usuário relatou o sintoma concreto que motivou a investigação: um
lançamento com `data_competencia` em maio, `data_vencimento` em julho e
`data_pagamento` em agosto aparecia no mês errado dependendo de qual tela
e qual filtro — não havia como saber, sem ler o código, qual data cada
"Período" realmente usava.

---

## ❗ Problema

`transacoes_financeiras` tem 3 datas independentes e nenhuma delas é
derivada das outras:

- `data_competencia` — accrual/fato gerador (ADR-001), alimenta o DRE por
  competência. Editável pelo usuário independente do vencimento.
- `data_vencimento` (`NOT NULL`) — data prevista/esperada.
- `data_pagamento` (nullable) — quando o dinheiro efetivamente moveu.
  Coluna única compartilhada por `tipo='entrada'` (recebimento) e
  `tipo='saida'` (pagamento).

Sem um eixo explícito e visível, o usuário não conseguia prever em qual
mês/tela um lançamento apareceria, nem confiar que "Regime de Caixa" no
DRE realmente significava caixa.

---

## ✅ Decisão

Dois eixos ortogonais, mantidos conceitualmente separados:

1. **Tipo de Data** (Vencimento | Pagamento) — qual coluna uma listagem
   usa pra filtrar/ordenar/agrupar por período. Vencimento é o default e
   permanece o filtro primário em todo lugar ("preciso saber quando vai
   entrar e quando vai pagar" — feedback direto do usuário). O seletor só
   adiciona a opção de trocar, não inverte o padrão.
2. **Regime** (Caixa | Competência) — já existia só no DRE; decide quais
   `status` entram no relatório. Regime de Caixa agora também troca o eixo
   de agrupamento pra `data_pagamento` (antes só filtrava `status='pago'`
   e continuava agrupando por competência — inconsistente com o próprio
   nome "Caixa").

### UI

Seletor "Tipo de Data" (componente `TipoDataFiltroSelect`) adicionado em
Entradas/Saídas, Exportação, Dashboard, Insights e Contas.
Label da opção 2 varia por contexto: "Recebimento" (telas só de entrada),
"Pagamento" (telas só de saída), "Data de Caixa" (telas mistas — termo já
usado no DRE, evita a barra de "Pagamento/Recebimento"). Em Entradas/
Saídas, Dashboard, Contas e DRE, o próprio seletor de período (MonthPicker/
Regime/Ano) virou um pill clicável na posição onde antes só existia um
badge estático de período — mesmo visual (`text-xs`, `rounded-full`,
ícone `w-3 h-3`) do badge que já existia.

### Regra para pendentes em modo Pagamento

Lançamentos com `data_pagamento IS NULL` (pendentes) simplesmente somem da
lista quando o eixo é Pagamento — comportamento natural de um filtro
`gte/lte` contra `NULL`, sem lógica especial. Adicionalmente, **todo
agregado em eixo Pagamento exige `status='pago'` explicitamente** (não só
"tem `data_pagamento` no período") — uma transação paga e depois
cancelada mantém `data_pagamento` preenchida
(`20260728170000_fin_taxa_entrada_subtrai_liquido.sql`), então sem esse
filtro extra ela continuaria contando em caixa mesmo cancelada. Essa
exigência é a mesma usada por `get_dre_anual(p_regime='caixa')`.

### Backend

- `fin_resumo_periodo` (comparativo "mês anterior" do Dashboard) ganhou
  `p_eixo` (`vencimento` default | `pagamento`), migration
  `20260729160000`. Regra de eixo pagamento: `data_pagamento` no período
  **e** `status='pago'` — mesma semântica do `get_dre_anual`.
- `get_dre_anual` (migration `20260729120000`) — regime de caixa agora
  agrupa/filtra ano por `data_pagamento`, competência por
  `data_competencia`, em vez de sempre `data_competencia`.

### UTC shift em exports/insights (achado durante o review)

`new Date("YYYY-MM-DD")` é interpretado como meia-noite UTC — em fusos a
oeste de UTC (Brasil) isso volta um dia no horário local. Corrigido em
`formatDateForExport` (causa raiz, `src/lib/exportUtils.ts` — só ativa o
parse local pra strings `YYYY-MM-DD` puras, timestamptz completo como
`pessoas.data_primeira_visita` segue o caminho original) e em
`processarInsights` (tendência mensal e data das anomalias em Insights).

---

## 🧩 Alternativas rejeitadas

### Regime de Caixa decidir a coluna, sem Tipo de Data separado
Mais simples (um eixo só), mas confunde dois conceitos distintos: "o que
entra no relatório" (regime/status) e "qual coluna ordena a listagem"
(tipo de data). Rejeitado — Reclassificação já expunha vencimento e
competência como filtros separados antes desta mudança, então já havia
precedente de tratá-los como eixos independentes.

### Inverter o default para Pagamento
Rejeitado por feedback direto do usuário: vencimento é o que responde "o
que vai entrar/sair", uso mais frequente no dia a dia do tesoureiro.

---

## 👍 Consequências

- Toda listagem agora indica visualmente (pill clicável) qual data está
  usando, resolvendo a confusão original.
- DRE de Caixa muda de valor pra meses com lançamentos pagos fora do mês
  de competência — validado contra produção antes de aplicar: dezenas de
  lançamentos reais em 2025 com essa característica (diferença de até
  ~R$ 38 mil num único mês). Comportamento correto, mas é uma mudança
  visível pro usuário que já usava o DRE de Caixa.

## ⚠️ Trade-offs

- Mais um parâmetro em RPCs já existentes (`fin_resumo_periodo`,
  `get_dre_anual`) — default preserva compatibilidade, mas quem chamar
  essas funções precisa saber que o eixo agora importa.
- `LancamentoCard`, `agruparPorData`, calendários e `processarInsights`
  precisaram receber o eixo explicitamente — várias funções que antes
  hardcoded `data_vencimento` agora recebem a coluna como parâmetro
  (achados de review, não da implementação inicial — ver Status abaixo).

## 🔁 Diagramas Relacionados

- [DRE](../diagramas/dre.md) — seção "Regime de Caixa vs Competência"

## 📚 Documentação Relacionada

- `docs/arquitetura-financeiro.md` §9.20
- [ADR-001](ADR-001-separacao-fato-gerador-caixa-dre.md) — separação
  original fato gerador/caixa/DRE, base conceitual desta decisão

## 🏁 Status de implementação

Entregue em jul/2026 (PR #65). Implementação inicial cobriu o seletor e
as queries de busca; 3 rodadas de review automático (Codex) encontraram
que a busca trocava de eixo mas várias apresentações downstream
continuavam hardcoded em `data_vencimento` (agrupamento, calendário,
card de lançamento, tendência de Insights, comparativo do Dashboard) —
todas corrigidas na mesma PR. Detalhes técnicos completos em
`docs/arquitetura-financeiro.md` §9.20.

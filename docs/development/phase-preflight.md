# Phase Preflight

Passo obrigatório ANTES de editar código de implementação, quando a mudança
é grande o suficiente pra merecer uma fase própria (ver
`docs/development/change-lifecycle.md` pra quando isso se aplica — não é
pra toda edição pequena). Objetivo: decidir quais guardrails já conhecidos
neste repo viram invariantes explícitas desta fase, antes que um review
tenha que redescobrir isso.

## 1. Leia a fase/ADR e a acceptance criteria

O que essa fase precisa entregar, e como alguém vai saber que entregou.

## 2. Inspecione o estado REAL do repositório

A ADR (quando existir) descreve a intenção; o código current descreve a
realidade — fases anteriores podem ter mudado premissas que a ADR
assumia quando foi escrita. Não implemente em cima da ADR sozinha; confira
contra o schema/RPC/componente real primeiro (`grep -rl "CREATE OR REPLACE
FUNCTION public.<nome>"` pra RPC, `pg_policies`/`supabase db dump --linked`
pra RLS — nunca confie em memória de sessão nem em migration histórica
como se fosse o estado atual, ver `docs/guardrails-financeiro.md` §B.6).

## 3. Determine quais guardrails se aplicam

Não é checklist cego — decida com base no que a fase realmente toca:

| A fase toca... | Consulte |
|---|---|
| Query que filtra por `filial_id` | `guardrails-financeiro.md` §A |
| RPC `fin_*` `SECURITY DEFINER` nova ou editada | `guardrails-financeiro.md` §B |
| Trigger em `transacoes_financeiras` ou tabela relacionada | `guardrails-financeiro.md` §C |
| `SELECT ... FOR UPDATE`/lock explícito | `guardrails-financeiro.md` §D |
| Migration com `ADD CONSTRAINT`/`CREATE UNIQUE INDEX`, ou rename de migration não-aplicada | `guardrails-financeiro.md` §E |
| `useEffect` reagindo a dado de query, botão dependente de múltiplas queries | `guardrails-financeiro.md` §G |
| Parser de CSV/import externo | `guardrails-financeiro.md` §H |
| `ON DELETE SET NULL` numa FK existente | `guardrails-financeiro.md` §J |
| Erro de RPC/Postgres indo pro WhatsApp, fornecedor via OCR | `guardrails-financeiro.md` §L |
| `CREATE POLICY`, ou gate de UI atrás de `has_role(admin)` | `guardrails-financeiro.md` §M |
| Padrão recorrente de review/CI (não financeiro) | `docs/guardrails-processo.md` |

Quando nenhuma linha bater com precisão, ainda assim vale abrir os dois
documentos e ler os títulos de seção — um padrão adjacente pode se aplicar
mesmo sem bater literalmente.

## 4. Estabeleça o Implementation Contract

Antes de tocar em código, escreva (mentalmente ou num rascunho — não
precisa virar documento formal pra fase pequena):

- **Invariantes** que precisam continuar verdadeiras depois da mudança.
- **Comportamento que não pode acontecer** (ex.: escrita cross-tenant,
  saldo incremental, `FOR ALL` implícito numa policy nova).
- **Caminhos afetados** — não só o caminho feliz: leitura, insert, update,
  delete, retry, replay/reprocessamento, fallback, execução concorrente,
  migration/backfill, quando aplicável.
- **Casos de borda** que precisam de tratamento explícito.
- **Evidência necessária** pra provar cada invariante no Self Check —
  decida AGORA como vai testar (harness Postgres real, 2 sessões `psql`
  pra concorrência, etc.), não depois de já ter implementado.

## Não pule o Preflight porque...

- a ADR já tem um plano detalhado;
- uma fase anterior já foi analisada;
- a mudança parece pequena;
- um código parecido já foi implementado antes.

Cada um desses já foi razão real, em PRs passadas deste repo, pra uma
invariante conhecida ser redescoberta via review em vez de identificada
antes — ver `docs/guardrails-financeiro.md` §B.9 (RPC tocada na mesma sessão
que já sabia da classe de bug, e mesmo assim ficou "pra depois").

Implementação deve reconciliar as três fontes: a ADR descreve intenção, o
repositório atual descreve realidade, os guardrails descrevem modo de falha
já acumulado.

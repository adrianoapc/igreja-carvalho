# Guardrails — módulo financeiro

Antes de escrever ou revisar qualquer RPC `fin_*`, trigger, migration ou tela
que mexa em contas/transações/formas de pagamento/categorias, leia
[`docs/guardrails-financeiro.md`](docs/guardrails-financeiro.md). Resumo do
que está lá (detalhe completo, com o `§9.NN` de origem de cada regra, no
próprio arquivo):

- **Regra de ouro**: as 7 tabelas core do financeiro têm `INSERT/UPDATE/
  DELETE` revogados de `authenticated`/`anon` — toda escrita passa por RPC
  `fin_*` `SECURITY DEFINER`. Nunca reintroduzir escrita direta.
- **Filial compartilhada** (`filial_id IS NULL`): use `.or("filial_id.eq.X,
  filial_id.is.null")`, nunca `.eq()` puro, em qualquer query que deva
  enxergar registros globais.
- **RPC `SECURITY DEFINER`**: sempre resolver `igreja_id` via
  `fin_resolver_contexto`, validar `has_filial_access` contra a filial
  EFETIVA, e repassar o contexto (não `NULL`) pra RPCs aninhadas.
  Arrays JSON irmãos (ex.: `transacao_ids` + `divisoes`) precisam da
  mesma validação; `filial_id` de audit/relatório ≠ filial de junção
  (ator vs recurso). Lookups irmãos em `user_filial_access` (`EXISTS`
  grant vs `NOT EXISTS` legado) precisam do mesmo `igreja_id` — unique
  em `(user_id, filial_id)` não substitui o predicado de tenant.
- **Trigger de saldo de conta**: sempre recalcula do zero a partir de
  `transacoes_financeiras` — nunca soma/subtrai incrementalmente. Dispara em
  INSERT/UPDATE/DELETE (sem `OF <colunas>`, statement-level com transition
  tables) — nenhuma RPC precisa "tratar saldo" manualmente.
- **Concorrência**: ordem determinística de lock (`ORDER BY id`), lock mais
  fraco possível (`FOR NO KEY UPDATE`), trave antes de ler numa statement
  separada (READ COMMITTED dá snapshot novo por statement).
- **Testing de SQL**: nunca confiar só em `deno check`/`tsc` — testar fix de
  backend num harness Postgres real (Docker) antes de commitar; concorrência
  exige 2 sessões `psql` de verdade, não simulação sequencial.
- **Processo de PR**: 1 fase = 1 PR, harness completo antes de abrir, `/code-
  review` local antes do 1º `@codex review`, batelar fixes antes de
  re-disparar review (cada disparo rescaneia a PR inteira).

Este arquivo é o resumo. O detalhe (com exemplos de bug real por item) está em
`docs/guardrails-financeiro.md`, que cresce a cada rodada de review que achar
um padrão novo — atualize os dois juntos.

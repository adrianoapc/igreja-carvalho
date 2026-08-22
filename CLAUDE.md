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
  O 2º argumento de `fin_resolver_contexto` (`p_flag_bot`) **só vale no
  canal bot** — no JWT, tesoureiro sem o flag de `profiles` ainda passa.
  Escrita que exige o flag no web precisa checar `autorizado_lancar_*`
  no JWT (ou não expor a ação).
- **`has_filial_access()`**: o shortcut de "`igreja_id` ausente no JWT =
  backwards compat" só dispara com `auth.uid() IS NOT NULL` (sessão
  autenticada de verdade) — sem isso, `anon` sem NENHUM JWT também batia
  no shortcut e ganhava acesso irrestrito (corrigido 2026-08-22). Qualquer
  policy `PUBLIC`/sem `TO authenticated` que usa a função como único gate
  ainda depende só dela — não confiar em `TO authenticated` como a defesa
  primária.
- **`origem_registro`**: literal novo numa RPC precisa da CHECK
  constraint na mesma PR (`manual`/`api`/`getnet_antecipacao_desagio`).
- **Ação de escrita nova** num card que já gateia irmãs por filial
  efetiva usa o mesmo gate; ID exposto por RPC de leitura só sai com
  `has_filial_access` no recurso alvo.
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
- **Paleta de status**: `STATUS_COLOR` em `statusPalette.ts` é fundo de
  pill, não tinta — nunca `color: STATUS_COLOR` em card claro (`warning`
  falha WCAG 3:1). Use `pillStyle(tone)`.
- **Canal WhatsApp**: erro de RPC/Postgres não vai cru pra conversa
  (mapear `FIN_*`, resto genérico; raw só no log). OCR sem CPF/CNPJ
  reusa fornecedor por nome — não criar "Shopee" duplicado a cada print.
- **Renomear migration nunca-aplicada** (fix de colisão de timestamp):
  `grep -l` por toda função que o arquivo redefine, comparar contra
  QUALQUER migration mais recente que também a redefina (aplicada ou
  não) e mesclar os corpos — senão o `CREATE OR REPLACE` da renomeada
  roda por último e reverte silenciosamente a mais recente (sem erro,
  sem warning). PR mergeada em `main` **não** garante deploy aplicado —
  `supabase db push` recusa o lote inteiro por timestamp fora de ordem
  sem alertar além do X no GitHub Actions; checar `gh run list
  --workflow=supabase-deploy.yml` antes de confiar num Advisor achado
  "já corrigido".
- **`REVOKE ALL ... FROM anon` não fecha nada** — `EXECUTE` é concedido
  a `PUBLIC` por padrão, e `anon`/`authenticated` herdam via `PUBLIC`,
  não por grant próprio. Só `REVOKE ... FROM PUBLIC` fecha de verdade;
  revogar de um role nomeado é no-op se `PUBLIC` ainda segura o acesso.
  Confirmar sempre com `supabase db advisors --linked` (não o cache do
  dashboard).
- **`CREATE POLICY` sem `FOR` vira `FOR ALL`** — restaurar sempre com
  `git log -S` pra achar o `FOR` original. Gate de UI pra ação
  destrutiva atrás de uma policy `has_role(admin)` precisa aceitar o
  MESMO conjunto de roles que a função (`admin`/`admin_igreja`/
  `admin_filial`, não só o `isAdmin` genérico do frontend). `.delete()`
  sem `{ count: "exact" }` mostra sucesso mesmo quando o RLS nega.
- **`ALTER POLICY` numa coluna inexistente falha silenciosamente** sem
  derrubar o resto do arquivo de migration (não roda em transação
  explícita) — a policy afetada fica órfã na definição anterior (ou
  simplesmente some, se removida manualmente depois). Só aparece
  comparando `pg_policies` real (`supabase db dump --linked`) contra a
  intenção documentada da migration, nunca por `deno check`/`tsc`.
- **RLS de `UPDATE` por dono da linha não restringe QUAIS colunas
  mudam** — `USING`/`WITH CHECK` só validam a linha, não o payload. Um
  PATCH direto via PostgREST pode alterar qualquer coluna (incluindo
  FKs estruturais) desde que o resultado final ainda passe no mesmo
  check de dono. Ação legítima que só deveria tocar 1-2 colunas precisa
  de um trigger `BEFORE UPDATE` (ou RPC dedicada) que trave o resto.

Este arquivo é o resumo. O detalhe (com exemplos de bug real por item) está em
`docs/guardrails-financeiro.md`, que cresce a cada rodada de review que achar
um padrão novo — atualize os dois juntos.

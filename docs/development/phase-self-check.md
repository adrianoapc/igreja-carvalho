# Phase Self Check

Passo obrigatório DEPOIS de implementar e testar, ANTES de abrir a PR ou
disparar o primeiro `@codex review` — companion do
`docs/development/phase-preflight.md`. Objetivo: confirmar cada invariante
do Implementation Contract com evidência concreta, não com "parece que
funciona".

## 1. Rode os testes relevantes

- Todo fix de SQL/trigger/RPC precisa de harness Postgres real (Docker)
  antes de commitar — nunca só `deno check`/`tsc`. Reproduza o bug primeiro
  (aplique a versão COM o bug, confirme que reproduz), depois aplique o fix
  e confirme o VALOR final esperado, não só "não deu erro"
  (`guardrails-financeiro.md` §F).
- Concorrência exige 2 sessões `psql` reais (uma em background com
  `pg_sleep` segurando o lock), nunca simulação sequencial (§D.4, §F.2).
- Se um cenário de corrida não pode ser forçado deterministicamente, diga
  isso explicitamente em vez de fingir uma reprodução que não aconteceu
  (§F.3).

## 2. Rode lint, typecheck e formatação

`npm run lint`, `tsc --noEmit` (ou `tsc -p tsconfig.app.json --noEmit` se o
escopo tocado justificar o check mais rígido — ver limitação conhecida do
hook em `docs/guardrails-processo.md`).

## 3. Compare contra as MESMAS invariantes do Preflight

Não uma lista nova, não uma impressão geral — pegue o Implementation
Contract escrito no Preflight e vá invariante por invariante.

## 4. Dê evidência concreta pra cada invariante

Um item do checklist sem evidência anexada (saída de teste, resultado de
harness, query real, screenshot) não conta como verificado. "Rodei e não
deu erro" não é evidência de que o VALOR certo foi produzido — ver o achado
de `has_filial_access(NULL, NULL)` retornando `NULL` em vez de `false`
(`guardrails-financeiro.md` §B.15): o harness anterior só checava "não deu
erro"; só comparar o valor pegou o bypass.

## 5. Corrija todo FAIL; investigue todo UNPROVEN

Não declare a fase completa com uma invariante aplicável em FAIL ou
UNPROVEN.

## 6. Só então rode o review interno

Critério já estabelecido em `docs/guardrails-processo.md` — não duplicar
aqui, só aplicar:

- `/code-review` em `high` quando a mudança toca lógica de dado, agregação,
  sync/conciliação, dedupe/merge, dado financeiro, migration, ou outro
  comportamento de alto risco coberto pelos guardrails do repo.
- `/security-review` quando a mudança toca autenticação, autorização,
  permissões, RLS, secrets, operação privilegiada/admin, ou input externo
  cruzando fronteira de confiança.

Review interno é uma rede de segurança independente — não substitui o
Preflight nem este Self Check, e precisa terminar ANTES de abrir a PR pro
primeiro `@codex review`/Cursor. Não espere o review externo apontar o
primeiro achado pra só então rodar o interno — o objetivo é não pagar
rodada de review externo (cada disparo rescaneia a PR inteira, ver
`guardrails-financeiro.md` §I.6) por violação que já devia ter sido pega
aqui.

## 7. Batelar fixes antes de re-disparar review externo

Se o review externo já rodou e achou algo, corrija tudo que já foi
levantado antes de pedir uma nova rodada — não disparar a cada fix isolado.

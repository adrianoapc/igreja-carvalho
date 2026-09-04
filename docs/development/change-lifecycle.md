# Ciclo de vida de uma mudança

Mapa curto de como uma mudança percorre este repo, do problema até o merge.
Não é um processo novo — é a ordem em que peças que já existem (ADR,
guardrails, `/code-review`, `/security-review`, branch protection) se
encaixam. Ver `CLAUDE.md` §Mandatory ADR Phase Workflow pro detalhe de cada
etapa de implementação.

```
Problema / pedido
    ↓
Discovery — vale uma ADR?
    ↓
[se sim] ADR (Status: Proposto → Aceito)         [se não] direto pra Fase
    ↓                                                  ↓
Fase (1 fase = 1 PR — guardrails-financeiro.md §I)
    ↓
Phase Preflight (docs/development/phase-preflight.md)
    ↓
Implementation Contract (invariantes explícitas)
    ↓
Implementação
    ↓
Testes + harness determinístico (Postgres real p/ SQL, 2 sessões p/ concorrência)
    ↓
Phase Self Check (docs/development/phase-self-check.md)
    ↓
PASS com evidência por invariante
    ↓
Review interno (/code-review, /security-review)
    ↓
Review externo (@codex review / Cursor Bugbot)
    ↓
Merge (branch protection: docs_guard + pattern_guardrails verdes, sem push direto)
```

## Quando vale uma ADR

Nem toda mudança precisa de ADR — a maioria das ~100 PRs dos últimos 3
meses não teve uma. Escreva uma quando a mudança:

- introduz ou muda uma decisão arquitetural que outras partes do sistema
  vão depender (ver `docs/adr/README.MD` pros 28+ exemplos já aceitos);
- tem mais de uma abordagem razoável e a escolhida não é óbvia a partir do
  código;
- é grande o suficiente pra valer a pena quebrar em fases (múltiplas PRs
  sequenciais, cada uma sob o guardrail "1 fase = 1 PR").

Uma ADR nasce com `Status: Proposto`. Só vira alvo do Mandatory ADR Phase
Workflow depois de `Status: Aceito` — implementar a partir de uma proposta
ainda não aceita é decidir a arquitetura durante a implementação, exatamente
o que o Preflight existe pra evitar.

## Por que isso existe

`docs/guardrails-financeiro.md` (seções B.5, B.9, M.7–M.9) documenta várias
classes de bug que levaram 2 a 4 rodadas de review pra fechar — o padrão
comum é implementar primeiro e descobrir a invariante quebrada depois, via
achado de review, em vez de identificá-la antes de escrever código. O
Preflight formaliza o passo que já funcionava quando seguido à risca
("ler os guardrails aplicáveis antes de implementar") e o Self Check
formaliza a verificação de volta contra a MESMA lista de invariantes — não
uma checagem genérica de "parece que funciona".

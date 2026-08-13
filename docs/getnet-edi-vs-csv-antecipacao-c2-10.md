# C2-10 — Validação `numeroOperacao` (EDI) vs `contrato_registradora` (CSV)

**Veredito: batem. `numeroOperacao` do EDI (tipo 5/6) identifica o
mesmo evento que `contrato_registradora` do CSV, com um dígito de
prefixo a mais no lado EDI (não é ruído).**

## Objetivo

Validar, com um evento real de antecipação (não simulado), se
`numeroOperacao` (`getnet_financeiro_resumo`/`getnet_financeiro_
detalhe`, tipo 5/6, capturados na C2-4/C2-5) e `contrato_registradora`
(`getnet_recebivel_lancamentos`/`getnet_antecipacao_lotes`, CSV)
identificam o mesmo evento de cessão de crédito — pré-condição pra
qualquer vínculo automático entre as duas fontes.

## Evento real usado

Antecipação solicitada e executada pelo usuário no portal Getnet,
contrato datado de 2026-08-11, capturada nos dois canais no mesmo dia
em que este documento foi escrito (2026-08-13):

| Campo | EDI (`getnet_financeiro_resumo`) | CSV (`getnet_recebivel_lancamentos` / `getnet_antecipacao_lotes`) |
|---|---|---|
| Identificador | `numero_operacao = "02026081101189356017"` | `contrato_registradora = "2026081101189356017"` |
| Tipo | `tipo_operacao = "CS"` (Cessão de Crédito) | `lancamento = "Valor Total Da Cessão A Pagar"` |
| Data | `data_operacao = 2026-08-11` | `data_vencimento = 2026-08-11` / `data_contratacao_contrato = 2026-08-11` |
| Valor bruto | 80.00 | 80.00 |
| Deságio | **3.72** (`valor_custo_operacao`) | — não presente em nenhuma linha do CSV |
| Valor líquido | 76.28 | — |
| Credor | Banco Santander S.A., ag. 000037, cc 130158884 (`participante_*`) | — |

`numeroOperacao` tem 1 dígito de prefixo a mais que `contrato_
registradora` (`"0" + contrato_registradora`) — esse dígito é um
indicador próprio do layout EDI, não faz parte do número do contrato
em si (o layout já separa `tipo_operacao` como campo próprio). Depois
de remover o prefixo, os dois números são idênticos.

## Achado adicional — CSV não tem o deságio, EDI tem

O CSV mostra só o lançamento contábil espelho (`Valor Total Da Cessão
Pago` −80,00 / `Valor Total Da Cessão A Pagar` +80,00 — bruto entrando
e saindo, sem detalhar a taxa). O EDI tem o deságio real
(`valor_custo_operacao = 3.72`) e os dados bancários do credor. Hoje
(`fin_lancar_desagio_antecipacao`) o deságio é lançado manualmente
(usuário informa categoria/conta) — o EDI abre a possibilidade de
capturar esse valor automaticamente no futuro, mas isso é decisão da
C2-11, não desta fase.

## Ressalva de amostra (mesma lição da C2-9)

Este veredito usa **1 evento real**. É suficiente pra confirmar que o
MECANISMO de comparação funciona (os dois campos realmente
correspondem ao mesmo evento, com uma transformação simples e
determinística) — não é suficiente pra garantir que todo contrato
sempre vai casar sem exceção (parcelamentos, cessões parciais,
diferentes bandeiras/produtos podem ter formatos de `numeroOperacao`
diferentes, ainda não observados). Antes de qualquer RPC de produção
que dependa desse vínculo automaticamente, testar contra mais eventos
reais conforme forem surgindo.

## Decisão

Mecanismo de comparação validado; nenhuma RPC de produção criada nesta
fase (por design do C2-10 original — fica pra C2-11). C2-11 (fonte de
verdade do lote de antecipação) pode agora prosseguir com este evento
como base, mas com a mesma ressalva de amostra pequena — não fechar
decisão de "EDI é fonte de verdade do deságio" com n=1.

## Relacionadas

[[project-conciliacao-cartao-ciclo2-status]],
`docs/getnet-edi-vs-csv-hop2-spike.md` (C2-9, mesma sessão)

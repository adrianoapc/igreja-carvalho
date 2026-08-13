# Spike C2-9 — Hop1/Hop2 sobre EDI (`getnet_analitico.nsu_cv`) vs CSV (`getnet_recebivel_lancamentos`)

**Veredito revisado (2026-08-13, 2ª rodada): inconclusivo por amostra
pequena demais — NÃO trocar nada agora. Rodar EDI (cron) e CSV
(manual) em paralelo, sem escolher "principal", até ter volume real
maior ou os arquivos antigos do SFTP liberados pelo suporte Getnet.**

> Nota: a 1ª versão deste documento (mesmo dia) concluía "não compensa
> migrar, manter CSV" com mais confiança do que os dados sustentavam —
> baseada em 11 arquivos reais (o único backlog que sobrou após o
> incidente do cron) com exatamente 1 venda real na janela comparável.
> Reescrito depois de o usuário questionar corretamente: trocar uma
> engine automatizada por processo manual é uma decisão cara pra
> basear em amostra tão pequena. Ver "Achado 4" abaixo pra o que essa
> 2ª rodada mudou.

## Objetivo

Avaliar se compensa reescrever `fin_gerar_candidatos_oferta_venda_getnet`/
`fin_vincular_venda_getnet_oferta` (hoje sobre o CSV "Recebível Extrato
Detalhado") pra usar `getnet_analitico.nsu_cv` (EDI, `UNIQUE(integracao_id,
rv, nsu_cv)`) — eliminando a dependência do CSV pra vendas avulsas.

## Contexto: por que só agora foi possível rodar o spike com dado real

Os crons que alimentam o EDI (`getnet-sync-automatico`) nunca tinham
funcionado desde a criação — ver
[[project-cron-jobs-nunca-funcionaram-incidente]]. Corrigido em
2026-08-13 (PR #101), mas o SFTP da Getnet só ainda tinha 11 dias de
arquivo disponíveis (2026-08-02 a 2026-08-12); ~2 meses de histórico
anterior foram perdidos. Este spike usa exatamente esses 11 arquivos
reais (únicos que já existiram) mais o CSV "Recebível Extrato
Detalhado" real do portal (2025-04-01 a 2026-08-13, 568 linhas, 222
"Vendas"), importado no mesmo dia via a tela de produção.

## Achado 1 — NSU casa com o EDI: 100% (2/2 amostras reais)

Os únicos 2 registros que `getnet_analitico` já teve (de qualquer
período, não só a janela de 11 dias) foram cruzados manualmente contra
o CSV antes da importação e reconfirmados depois:

| RV | `nsu_cv` (EDI) | NSU (CSV) | Data venda | Valor |
|---|---|---|---|---|
| 004258588 | `000000000275` | `000000275` | 2025-11-10 | R$ 823,80 |
| 005349054 | `000000000015` | `000000015` | 2026-08-02 | R$ 200,00 |

Match exato em valor/data nos dois casos (NSU do EDI vem com 12 dígitos
zero-padded; o CSV, com 9 — mesmo número). Quando o EDI tem o dado, o
dado é confiável.

## Achado 2 — lacuna estrutural real: a maioria dos arquivos não traz linha analítica

`getnet_analitico` é alimentado pela linha tipo `"2"` do layout
`extrato_eletronico_v10` (`getnetExtratoParser.ts`). Rodando o parser
real contra os 6 arquivos mais recentes do backlog (2026-08-07 a
2026-08-12):

| Arquivo | resumos (tipo1) | **analíticos (tipo2)** | ajustes (tipo3) | finResumo (tipo5) | finDetalhe (tipo6) |
|---|---|---|---|---|---|
| 08-07 | 0 | 0 | 0 | 0 | 0 |
| 08-08 | 0 | 0 | 0 | 0 | 0 |
| 08-09 | 0 | 0 | 0 | 0 | 0 |
| 08-10 | 2 | **1** | 1 | 1 | 3 |
| 08-11 | 0 | 0 | 0 | 0 | 0 |
| 08-12 | 1 | **0** | 1 | 1 | 1 |

Nos 11 arquivos reais completos (backfill de 2026-08-13), o total foi
`getnet_analitico=2` contra `getnet_resumo=5`,
`getnet_financeiro_detalhe=4` — ou seja, mesmo em dias com atividade de
liquidação real (resumo/ajuste/financeiro presentes, ex. 08-12), a
linha analítica tipo-2 continua ausente. Não é um artefato do backfill
curto: é o conteúdo real do arquivo. **Só 2 de 11 arquivos (18%)
trouxeram qualquer linha tipo-2**, e mesmo entre os arquivos com
liquidação real, a maioria não trouxe.

Comparando com o CSV no MESMO recorte de data (`data_venda` entre
2026-08-02 e 2026-08-12): 1 linha "Vendas" — e essa 1 linha é
exatamente a mesma venda que aparece no único registro EDI daquele
período. Ou seja, dentro da janela onde os dois lados têm dado, não há
divergência de cobertura observada — mas a amostra é pequena demais (1
venda) pra generalizar, e o padrão de arquivos SEM nenhuma linha
tipo-2 (5 de 6 no teste acima) indica que a lacuna é do formato/
liquidação da Getnet pra este comerciante, não da integração.

## Achado 3 — esforço de portar

Não avaliado em profundidade — o Achado 2 já é suficiente pra decidir.
Migrar Hop1/Hop2 pra depender de uma linha que a maioria dos arquivos
reais não traz significaria perder candidatos de conciliação pra
grande parte das vendas, sem ganho compensatório (o CSV já cobre 100%
das vendas do portal, incluindo parceladas — 11 linhas pra 1 NSU
parcelado, confirmado na importação real de 2026-08-13).

## Achado 4 (2ª rodada) — o "gap" era menor do que parecia, mas não zero

Reexaminando o Achado 2 com mais rigor: contar "arquivos com linha
tipo-2" mistura duas perguntas diferentes (quantos ARQUIVOS têm
alguma linha tipo-2 vs. quantas VENDAS REAIS ficaram sem par). A
pergunta certa é a segunda. Decodificando os campos reais do registro
tipo 1 (resumo) dos 3 RVs que apareceram nos arquivos locais
(`numCvsAceitos`, `indicadorTipoPagamento`, `codigoProduto` — Manual
Técnico Getnet, `docs/Manual Extrato Eletronico_V10.1_V6.2024.pdf`):

| RV | Produto | Indicador | `numCvsAceitos` | Tem tipo-2? |
|---|---|---|---|---|
| 004258588 | SM (Mastercard Crédito) | LQ (liquidação) | 1 | **Sim** |
| 092066824 | SR (Débito Maestro) | LQ (liquidação) | 1 | **Não** — sem explicação |
| 163302965 | SM (Mastercard Crédito) | **PF** (previsão) | 1 | Não — **explicado** |

`PF` = "Previsão de Pagamento Futuro" (manual, linha 306) — é uma
PREVISÃO de repasse de antecipação/cessão, não uma liquidação nova;
não tem "Comprovante de Venda" pra detalhar porque a venda em si já
foi detalhada em outro momento. Isso explica o caso do contrato
`2026081101189356017` sem ser bug nem lacuna.

O RV `092066824` (LQ, produto de cartão real, `numCvsAceitos=1`)
**não tem explicação no manual** — deveria ter linha tipo-2 e não
achamos nenhuma no arquivo onde apareceu. Hipóteses não resolvidas:
(a) o comprovante estava num arquivo mais antigo, já purgado do SFTP
antes do backfill de 2026-08-13; (b) outra regra do manual ainda não
localizada; (c) gap real da Getnet. Usuário vai tentar com o suporte
Getnet liberar arquivos mais antigos do SFTP — se conseguir, esse RV
específico pode ser rastreável até o arquivo original.

**Conclusão da 2ª rodada**: 1 dos 2 "gaps" observados tem explicação
legítima no próprio manual (não é falha de cobertura); o outro
continua genuinamente sem explicação, mas é 1 caso — não é base
suficiente pra afirmar "estrutural" nem "resolvido". Amostra total
ainda é de 3 RVs reais.

## Decisão

**Não trocar nada agora.** Manter os dois pipelines rodando em
paralelo, sem eleger "principal" pro Hop1/Hop2:
- Cron EDI (`getnet-sync-automatico`) continua automático, de graça —
  nenhum motivo pra desligar.
- Import manual do CSV (`ImportarRecebivelGetnetTab.tsx`) continua
  disponível — também barato, uso ocasional.
- `getnet_analitico.nsu_cv` serve hoje como **sinal de cross-check**
  quando disponível (como usado neste próprio spike) — não é fonte
  única de nada ainda.

**Revisitar quando**: (a) o suporte Getnet liberar arquivos SFTP mais
antigos (mais amostra, e chance de rastrear o RV 092066824), ou (b)
depois de alguns meses de cron rodando normalmente acumular volume
real suficiente pra uma decisão estatisticamente sólida. Não fixado
prazo — condição é volume/dado, não calendário.

C2-10/C2-11 (validação `numeroOperacao` vs `contrato_registradora`,
fonte de verdade do lote de antecipação) usam `getnet_financeiro_
resumo`/`getnet_financeiro_detalhe` (tipo 5/6), não `getnet_analitico`
— não são afetadas por este veredito. Aliás, **C2-10 já está
desbloqueada**: o contrato `2026081101189356017` é um evento AC real
(antecipação solicitada e executada), e a comparação
`numeroOperacao` (EDI) × `contrato_registradora` (CSV) já foi feita
neste spike com match perfeito (valor bruto 80.00 nos dois lados,
mesma data 11/08/2026) — ver seção própria a criar em C2-10.

## Relacionadas

[[project-conciliacao-cartao-ciclo2-status]],
[[project-cron-jobs-nunca-funcionaram-incidente]]

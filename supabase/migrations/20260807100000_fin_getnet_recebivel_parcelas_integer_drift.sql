-- ============================================================================
-- Hotfix — fecha drift de schema não rastreado em
-- getnet_recebivel_lancamentos.parcelas (2026-08-07).
--
-- getnet_recebivel_lancamentos foi criada em
-- 20260729100000_fin_recebivel_getnet_importacao.sql com `parcelas text`
-- (comentário: 'formato bruto do portal, ex. "1 de 7"'). Em produção real a
-- coluna está como `integer` (confirmado via information_schema.columns:
-- data_type=integer, udt_name=int4) — NENHUMA migration deste repositório
-- jamais alterou esse tipo. É drift não rastreado: produção diverge do que o
-- git assume, e nenhuma migration de replay reproduzia isso (o harness da
-- Fase 7a rodava contra `parcelas text`, por isso não pegou o bug abaixo).
--
-- Efeito do drift: várias RPCs fin_* (Fase 1/2/7a) fazem
-- `COALESCE(g.parcelas, '1 de 1')` seguido de `regexp_match(...)` assumindo
-- texto. Com a coluna sendo `integer`, `COALESCE(integer_col, '1 de 1')`
-- falha na hora de PLANEJAR a query (erro de tipo, code 22P02) — determinístico,
-- 100% das vezes, independente do conteúdo da linha. Comprovado com EXPLAIN
-- numa tabela `integer` vazia. As 129 linhas reais de produção têm
-- `parcelas` 100% NULL hoje — não há dado real do formato "N de M" para
-- migrar/preservar.
--
-- Esta migration só formaliza no git o que produção já é (ALTER idempotente
-- lá: já é integer). O propósito é fazer o REPLAY de migrations do zero
-- bater com a realidade — fecha a lacuna que deixou esse bug passar sem
-- harness pegar. Os fixes que param de tratar `parcelas` como "N de M" texto
-- estão em migrations separadas (mesma leva de hotfix):
--   - fin_listar_ledger_conciliacao_cartao (vendas_origem_agg)
--   - fin_vincular_venda_getnet_oferta (detecção de parcelamento Fase 2b)
--
-- USING precisa funcionar nos DOIS estados possíveis da coluna no momento em
-- que esta migration roda: `integer` (produção real, drift já presente) ou
-- `text` (replay do zero a partir do histórico do git, coluna ainda não
-- alterada). `NULLIF(parcelas, '')::integer` ingênuo QUEBRA contra uma coluna
-- já `integer` (o mesmo erro 22P02 que este hotfix inteiro existe pra
-- resolver — comprovado em Docker: ALTER numa tabela `integer` com esse
-- USING falha na hora). O CASE abaixo primeiro converte pra texto (round-trip
-- seguro nos dois sentidos: text→text é no-op, integer→text sempre
-- funciona), só aceita quando o resultado é 100% dígitos, e descarta
-- qualquer outra coisa (incluindo o formato antigo "N de M", que nunca foi
-- usado de verdade em produção) como NULL em vez de estourar.
-- ============================================================================

ALTER TABLE public.getnet_recebivel_lancamentos
  ALTER COLUMN parcelas TYPE integer
  USING CASE WHEN parcelas::text ~ '^[0-9]+$' THEN parcelas::text::integer ELSE NULL END;

COMMENT ON COLUMN public.getnet_recebivel_lancamentos.parcelas IS
  'Coluna integer (drift de schema fechado em 20260807100000 — produção real já era integer, git assumia text desde a criação da tabela). Hoje sempre NULL nas linhas reais: não guarda mais o rótulo bruto "N de M" do portal (isso exigiria uma 2ª coluna, que não existe). RPCs fin_* não tratam mais este campo como texto "parcela atual de total" — ver fin_listar_ledger_conciliacao_cartao/fin_vincular_venda_getnet_oferta.';

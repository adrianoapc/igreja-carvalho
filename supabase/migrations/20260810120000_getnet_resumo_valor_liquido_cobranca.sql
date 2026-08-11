-- ============================================================================
-- Deduções visíveis: valor_liquido_cobranca (Ciclo 2, C2-3)
--
-- O parser (`getnetExtratoParser.ts`) já captura `valorLiquidoCobranca`
-- (tipo 1, seq 29, bytes 255-266 — "valor líquido do aluguel do POS ou
-- ajuste de produtos verticais quando status=CI", manual pág. 13-14) e
-- `idBaixaCobrancaServico` (seq 32, byte 285) desde sempre — o gap é só no
-- INSERT: `resumoRows.map()` em `index.ts` nunca incluía os dois campos,
-- descartados entre parse e banco.
--
-- Sinal: o manual (pág. 14, seq 33) é explícito — "Os sinais fazem
-- referência ao valor líquido do resumo - sequência 14" (= valorLiquido,
-- não valorLiquidoCobranca). O campo seq 29 não tem coluna de sinal
-- própria nem é coberto pelo sinal geral — grava como magnitude simples
-- (mesmo `parseAmount` dos demais campos "amount" do parser), sem inverter
-- sinal. Consumidor (C2-4, tela de Ajustes) interpreta como dedução pelo
-- contexto (status CI / motivo_ajuste), não pelo sinal do valor.
-- ============================================================================

ALTER TABLE public.getnet_resumo
  ADD COLUMN IF NOT EXISTS valor_liquido_cobranca numeric(14,2),
  ADD COLUMN IF NOT EXISTS id_baixa_cobranca_servico text;

COMMENT ON COLUMN public.getnet_resumo.valor_liquido_cobranca IS
  'Tipo 1, seq 29 (bytes 255-266). Valor líquido do aluguel do POS ou ajuste de produtos verticais quando indicador_tipo_pagamento=CI (manual V10.1, pág. 13). Magnitude simples — sem sinal próprio (manual pág. 14: o campo "sinal" geral só se refere a valor_liquido, seq 14).';

COMMENT ON COLUMN public.getnet_resumo.id_baixa_cobranca_servico IS
  'Tipo 1, seq 32 (byte 285). Identificador "X" de baixa de cobrança de serviço externa (fora da agenda financeira) — relacionado ao status CI. Em branco quando a compensação ocorre na agenda financeira normal (manual V10.1, pág. 13-14).';

-- ── Marcador de progresso do backfill (achado do code-review) ──────────────
-- Sem isso, `backfill_resumo_cobranca` reprocessaria sempre os mesmos
-- `batchSize` primeiros arquivos a cada chamada — a paginação "chame de
-- novo até arquivos_restantes=0" não avançava. Mesmo padrão que
-- `getnet_arquivos` já usa como marcador de "já importado" pro sync normal.
ALTER TABLE public.getnet_arquivos
  ADD COLUMN IF NOT EXISTS resumo_cobranca_backfilled_at timestamptz;

COMMENT ON COLUMN public.getnet_arquivos.resumo_cobranca_backfilled_at IS
  'Marca que este arquivo já tem valor_liquido_cobranca/id_baixa_cobranca_servico preenchidos em getnet_resumo — via action=backfill_resumo_cobranca (C2-3, arquivo histórico) ou já no INSERT do import normal (import_extrato/sync, arquivo importado após C2-3, buildResumoRow grava os dois campos desde a origem). Exclui o arquivo de reprocessamentos futuros do backfill, permite paginar corretamente por lotes.';

-- ── acao "backfill_resumo_cobranca" no CHECK de integracoes_execucoes_log ──
-- Sem isso, startLog() falha silenciosamente pra essa action (catch interno
-- loga só no console) — o backfill roda e atualiza dado real, mas fica sem
-- nenhum rastro na tabela de auditoria (achado do code-review).
DO $$
DECLARE
  v_con text;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.integracoes_execucoes_log'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%acao%';
  IF v_con IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.integracoes_execucoes_log DROP CONSTRAINT ' || quote_ident(v_con);
  END IF;
END $$;

ALTER TABLE public.integracoes_execucoes_log
  ADD CONSTRAINT integracoes_execucoes_log_acao_check
  CHECK (acao IN (
    'test_connection',
    'list_files',
    'download_file',
    'import_extrato',
    'import_extrato_arquivo',
    'sync',
    'backfill_resumo_cobranca'
  ));

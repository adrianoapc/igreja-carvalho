-- ============================================================================
-- Ciclo 2 (C2-7) — Hop 1/Antecipação param de casar contra o próprio
-- espelho Getnet (fix cirúrgico, decisão explícita do usuário: sem
-- consumidor novo pra `getnet_credito_disponivel` nesta fase — ela fica
-- pronta pra quando a C2-8 cortar o espelho de vez).
--
-- Achado real (pesquisa pré-C2-7): `fin_gerar_candidatos_venda_banco_getnet`
-- e `fin_gerar_candidatos_lote_antecipacao_getnet` casam contra QUALQUER
-- `extratos_bancarios` não reconciliado, SEM filtrar `origem` — inclui as
-- próprias linhas sintéticas que o pipeline Getnet escreve
-- (`origem IN ('getnet_sftp_txt','getnet_sftp_tipo5')`, ver `getnet-sftp/
-- index.ts` + migration `20260812120000`). Uma venda Getnet podia (e,
-- pelo scoring de texto do lote — `%getnet%` vale +40 — provavelmente já
-- fez) casar com o PRÓPRIO espelho em vez do crédito bancário REAL do
-- Santander: silencioso, sem erro, com aparência de match legítimo. É
-- exatamente o problema estrutural que a separação extrato/cartão existe
-- pra resolver — não é hipotético, é o próprio "crédito não reconciliado
-- da conta" citado no plano original da C2-7.
--
-- Fix em 2 camadas (mesmo padrão de `fin_vincular_lote_bloqueia_hop1`,
-- que já fecha o double-booking Hop1×antecipação nas duas direções):
--   1. Candidatos (leitura): exclui origem espelho do pool — não SUGERE
--      mais a própria linha.
--   2. Vincular (escrita): rejeita explicitamente — não é só UX, fecha a
--      brecha pra qualquer chamada direta da RPC (não só via UI).
--
-- Migração de dado histórico: `fin_diagnosticar_vinculos_getnet_espelho`
-- (read-only) lista vínculos JÁ confirmados que apontam pro espelho —
-- decisão de reapontar ou não é do tesoureiro (plano original: "decidir
-- se são reapontadas... e o que acontece com casos sem correspondência
-- ainda", não é uma correção automática que este fix arrisca decidir
-- sozinho). `fin_desfazer_vinculo_venda_banco_getnet`/
-- `fin_desfazer_vinculo_lote_antecipacao` (novos — não existia NENHUM
-- mecanismo de desfazer pra estes 2 vínculos até agora) permitem desfazer
-- o vínculo errado pra depois re-vincular pelo fluxo normal (candidatos
-- já corrigidos por este fix acham o crédito real). Sem tela nova nesta
-- fase (decisão explícita) — uso via RPC direto até uma fase de UI.
-- ============================================================================

-- ─── 0. Helper: é o espelho sintético do próprio Getnet? ────────────────────
-- Centraliza a lista de origens espelho — usada em 6 lugares desta
-- migration (candidatos ×2, vincular ×2, diagnóstico ×2). Achado real do
-- code-review (angle cross-file tracer): a lista original só tinha
-- 'getnet_sftp_txt'/'getnet_sftp_tipo5' (tipo1/tipo5, layout
-- extrato_eletronico_v10) — faltava 'getnet_sftp' (layout settlement_v1,
-- que é o DEFAULT em `IntegracoesCriarDialog.tsx` pra integração nova e
-- grava direto em extratos_bancarios sem passar por getnet_resumo/
-- getnet_financeiro_resumo). Sem essa 3ª origem, o fix inteiro desta
-- migration seria um no-op pra qualquer integração no layout antigo —
-- exatamente o "venda casa com a própria sombra" que existe pra fechar.
-- Retorna NULL se p_origem for NULL (propagação normal do IN) — quem
-- chama decide se isso conta como "não é espelho" (candidatos, precisa do
-- `OR origem IS NULL` explícito) ou "não bloqueia" (vincular/diagnóstico,
-- onde `IF NULL THEN` já não entra no branch, mesmo comportamento de
-- antes desta migration pra origem NULL).
CREATE OR REPLACE FUNCTION public.fin_e_espelho_getnet(p_origem text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_origem IN ('getnet_sftp', 'getnet_sftp_txt', 'getnet_sftp_tipo5')
$$;

COMMENT ON FUNCTION public.fin_e_espelho_getnet(text) IS
  'C2-7: true se origem é um espelho sintético gravado pelo próprio pipeline Getnet (settlement_v1=getnet_sftp, extrato_eletronico_v10 tipo1/tipo5=getnet_sftp_txt/getnet_sftp_tipo5) — não é um crédito bancário real. Centraliza a lista usada por fin_gerar_candidatos_venda_banco_getnet/fin_vincular_venda_banco_getnet/fin_gerar_candidatos_lote_antecipacao_getnet/fin_vincular_lote_antecipacao/fin_diagnosticar_vinculos_getnet_espelho.';

GRANT EXECUTE ON FUNCTION public.fin_e_espelho_getnet(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_e_espelho_getnet(text) FROM anon;

-- ─── 1. Candidatos Hop 1 (leitura) — exclui origem espelho ─────────────────
CREATE OR REPLACE FUNCTION public.fin_gerar_candidatos_venda_banco_getnet(
  p_conta_id uuid,
  p_integracao_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date,
  p_contexto jsonb DEFAULT NULL,
  p_filial_id uuid DEFAULT NULL
)
RETURNS TABLE(
  data_vencimento date,
  filial_id uuid,
  valor_liquido numeric,
  recebivel_ids uuid[],
  extrato_id uuid,
  score numeric,
  features jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_integracao record;
  v_conta record;
  v_scope uuid;
BEGIN
  IF p_conta_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_conta_id é obrigatório';
  END IF;
  IF p_integracao_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_integracao_id é obrigatório';
  END IF;
  IF p_periodo_inicio IS NULL OR p_periodo_fim IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_periodo_inicio e p_periodo_fim são obrigatórios';
  END IF;
  IF p_periodo_fim < p_periodo_inicio THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_periodo_fim anterior a p_periodo_inicio';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT i.id, i.igreja_id, i.filial_id, i.provedor
    INTO v_integracao
    FROM public.integracoes_financeiras i
   WHERE i.id = p_integracao_id;

  IF v_integracao.id IS NULL OR v_integracao.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: integração inexistente ou fora do tenant';
  END IF;
  IF v_integracao.provedor IS DISTINCT FROM 'getnet' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: integração % não é do provedor getnet', p_integracao_id;
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_integracao.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da integração';
  END IF;

  SELECT c.id, c.igreja_id, c.filial_id
    INTO v_conta
    FROM public.contas c
   WHERE c.id = p_conta_id;

  IF v_conta.id IS NULL OR v_conta.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: conta inexistente ou fora do tenant';
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_conta.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta';
  END IF;

  IF p_filial_id IS NOT NULL THEN
    IF NOT public.has_filial_access(v_igreja, p_filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial solicitada';
    END IF;
    v_scope := p_filial_id;
  ELSE
    v_scope := NULL;
  END IF;

  RETURN QUERY
  WITH
  vendas AS (
    SELECT
      g.id,
      g.filial_id,
      g.data_vencimento,
      COALESCE(
        g.valor_liquido_parcela,
        g.valor_liquido,
        COALESCE(g.valor_parcela, g.valor_venda) - abs(COALESCE(g.descontos, 0))
      ) AS liquido
    FROM public.getnet_recebivel_lancamentos g
   WHERE g.integracao_id = p_integracao_id
     AND g.igreja_id = v_igreja
     AND g.extrato_bancario_id IS NULL
     AND g.contrato_registradora IS NULL
     AND g.data_vencimento IS NOT NULL
     AND g.data_vencimento BETWEEN p_periodo_inicio AND p_periodo_fim
     AND COALESCE(
           g.valor_liquido_parcela,
           g.valor_liquido,
           COALESCE(g.valor_parcela, g.valor_venda) - abs(COALESCE(g.descontos, 0))
         ) IS NOT NULL
     AND public.has_filial_access(v_igreja, g.filial_id)
     AND (
       v_scope IS NULL
       OR g.filial_id IS NULL
       OR g.filial_id = v_scope
     )
  ),
  grupos AS (
    SELECT
      v.data_vencimento,
      v.filial_id,
      SUM(v.liquido) AS valor_liquido,
      array_agg(v.id ORDER BY v.id) AS recebivel_ids
    FROM vendas v
   GROUP BY v.data_vencimento, v.filial_id
  ),
  creditos AS (
    SELECT
      e.id,
      e.filial_id,
      e.data_transacao,
      e.valor,
      e.descricao
    FROM public.extratos_bancarios e
   WHERE e.igreja_id = v_igreja
     AND e.conta_id = p_conta_id
     AND e.tipo = 'credito'
     AND e.reconciliado IS NOT TRUE
     -- C2-7: crédito precisa ser um movimento bancário REAL — o espelho
     -- sintético do próprio Getnet (mesma integração/venda) não conta,
     -- senão a venda casa com a própria sombra em vez do banco de verdade.
     -- `origem IS NULL OR ...`, não só `NOT IN` (achado do code-review,
     -- guardrail §9.62 item 3 do próprio repo): `NULL NOT IN (...)` é
     -- NULL, não TRUE — um crédito real com origem NULL sumiria do pool
     -- silenciosamente.
     AND (e.origem IS NULL OR NOT public.fin_e_espelho_getnet(e.origem))
     -- fin_vincular_lote_antecipacao NÃO marca reconciliado — excluir
     -- créditos já tomados por lote (evita double-booking Hop 1 × antecipação).
     AND NOT EXISTS (
       SELECT 1
         FROM public.getnet_antecipacao_lotes l
        WHERE l.extrato_bancario_id = e.id
     )
     AND e.data_transacao BETWEEN (p_periodo_inicio - 1) AND (p_periodo_fim + 1)
     AND public.has_filial_access(v_igreja, e.filial_id)
     AND (
       v_scope IS NULL
       OR e.filial_id IS NULL
       OR e.filial_id = v_scope
     )
  ),
  matches AS (
    SELECT
      g.data_vencimento,
      g.filial_id,
      g.valor_liquido,
      g.recebivel_ids,
      c.id AS extrato_id,
      CASE
        WHEN c.data_transacao = g.data_vencimento
         AND abs(c.valor - g.valor_liquido) <= 0.01 THEN 1.0::numeric
        WHEN abs(c.data_transacao - g.data_vencimento) = 1
         AND abs(c.valor - g.valor_liquido) <= 0.01 THEN 0.85::numeric
        -- Discrepância de valor sinalizada (visível na UI), score baixo.
        WHEN abs(c.data_transacao - g.data_vencimento) <= 1
         AND abs(c.valor - g.valor_liquido) > 0.01
         AND abs(c.valor - g.valor_liquido) <= GREATEST(1.00, abs(g.valor_liquido) * 0.05)
          THEN 0.50::numeric
        ELSE NULL
      END AS score,
      jsonb_build_object(
        'valor_extrato', c.valor,
        'data_transacao', c.data_transacao,
        'descricao', c.descricao,
        'delta_dias', (c.data_transacao - g.data_vencimento),
        'delta_valor', (c.valor - g.valor_liquido),
        'discrepancia', (abs(c.valor - g.valor_liquido) > 0.01),
        'filial_extrato', c.filial_id,
        'n_recebiveis', coalesce(array_length(g.recebivel_ids, 1), 0)
      ) AS features
    FROM grupos g
    JOIN creditos c
      ON abs(c.data_transacao - g.data_vencimento) <= 1
     AND (c.filial_id IS NULL OR g.filial_id IS NULL OR c.filial_id = g.filial_id)
     AND abs(c.valor - g.valor_liquido) <= GREATEST(1.00, abs(g.valor_liquido) * 0.05)
  )
  SELECT
    m.data_vencimento,
    m.filial_id,
    m.valor_liquido,
    m.recebivel_ids,
    m.extrato_id,
    m.score,
    m.features
  FROM matches m
  WHERE m.score IS NOT NULL
  ORDER BY m.score DESC, m.data_vencimento, m.extrato_id;
END;
$$;

COMMENT ON FUNCTION public.fin_gerar_candidatos_venda_banco_getnet(uuid, uuid, date, date, jsonb, uuid) IS
  'Fase 3 Conciliação Cartão Getnet (Hop 1, só leitura): agrupa getnet_recebivel_lancamentos sem antecipação (contrato_registradora IS NULL) e sem extrato_bancario_id por data_vencimento+filial, soma líquido, casa contra créditos bancários REAIS não reconciliados da conta (C2-7: exclui origem getnet_sftp_txt/getnet_sftp_tipo5 — o espelho sintético do próprio Getnet não é um crédito bancário; exclui também extratos já em getnet_antecipacao_lotes — antecipação não marca reconciliado). Discrepância de valor ≤5%/R$1 entra com score 0.5 (sinalizada). has_filial_access em integração, conta, recebível e extrato.';

-- ─── 2. Vincular Hop 1 (escrita) — rejeita espelho ──────────────────────────
CREATE OR REPLACE FUNCTION public.fin_vincular_venda_banco_getnet(
  p_extrato_bancario_id uuid,
  p_recebivel_ids uuid[],
  p_contexto jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_ext public.extratos_bancarios%ROWTYPE;
  v_rec record;
  v_ids uuid[];
  v_n int;
  v_liquido numeric(14,2) := 0;
  v_filiais_distintas uuid[] := '{}';
  v_tem_filial_compartilhada boolean := false;
  v_warnings text[] := '{}';
  v_delta numeric(14,2);
BEGIN
  IF p_extrato_bancario_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_extrato_bancario_id é obrigatório';
  END IF;
  IF p_recebivel_ids IS NULL OR coalesce(array_length(p_recebivel_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_recebivel_ids não pode ser vazio';
  END IF;

  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_ids
    FROM unnest(p_recebivel_ids) AS x;
  IF coalesce(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_recebivel_ids não pode ser vazio';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  -- Lock extrato primeiro (id único), depois recebíveis ORDER BY id.
  SELECT * INTO v_ext
    FROM public.extratos_bancarios
   WHERE id = p_extrato_bancario_id
   ORDER BY id
   FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: extrato % inexistente', p_extrato_bancario_id;
  END IF;
  IF v_ext.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_TENANT: extrato fora do tenant';
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_ext.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do extrato';
  END IF;
  IF v_ext.tipo IS DISTINCT FROM 'credito' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato bancário selecionado não é um crédito';
  END IF;
  IF v_ext.reconciliado IS TRUE THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato já reconciliado';
  END IF;
  -- C2-7: o espelho sintético do próprio Getnet não é um crédito bancário
  -- real — vincular uma venda a ele seria a venda casando com a própria
  -- sombra. Fecha a brecha na escrita, não só no candidato (achado real
  -- pré-C2-7: candidatos não filtravam origem, então isso era possível).
  IF public.fin_e_espelho_getnet(v_ext.origem) THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato é o espelho sintético do próprio Getnet, não um crédito bancário real — use um crédito com origem do banco';
  END IF;
  -- Antecipação não seta reconciliado — bloquear double-booking aqui também.
  IF EXISTS (
    SELECT 1
      FROM public.getnet_antecipacao_lotes l
     WHERE l.extrato_bancario_id = p_extrato_bancario_id
  ) THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato já vinculado a lote de antecipação';
  END IF;

  -- Âncora de filial: extrato entra no conjunto (guardrail #13).
  IF v_ext.filial_id IS NULL THEN
    v_tem_filial_compartilhada := true;
  ELSE
    v_filiais_distintas := ARRAY[v_ext.filial_id];
  END IF;

  PERFORM 1
    FROM public.getnet_recebivel_lancamentos g
   WHERE g.id = ANY (v_ids)
   ORDER BY g.id
   FOR NO KEY UPDATE;

  SELECT count(*) INTO v_n
    FROM public.getnet_recebivel_lancamentos g
   WHERE g.id = ANY (v_ids);
  IF v_n IS DISTINCT FROM array_length(v_ids, 1) THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: um ou mais recebíveis inexistentes';
  END IF;

  -- Outro grupo já apontando pra este extrato?
  IF EXISTS (
    SELECT 1
      FROM public.getnet_recebivel_lancamentos g
     WHERE g.extrato_bancario_id = p_extrato_bancario_id
       AND NOT (g.id = ANY (v_ids))
  ) THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato já vinculado a outros recebíveis Getnet';
  END IF;

  FOR v_rec IN
    SELECT g.*
      FROM public.getnet_recebivel_lancamentos g
     WHERE g.id = ANY (v_ids)
     ORDER BY g.id
  LOOP
    IF v_rec.igreja_id IS DISTINCT FROM v_igreja THEN
      RAISE EXCEPTION 'FIN_TENANT: recebível % fora do tenant', v_rec.id;
    END IF;
    IF NOT public.has_filial_access(v_igreja, v_rec.filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do recebível %', v_rec.id;
    END IF;
    IF v_rec.extrato_bancario_id IS NOT NULL
       AND v_rec.extrato_bancario_id IS DISTINCT FROM p_extrato_bancario_id THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: recebível % já vinculado ao extrato %',
        v_rec.id, v_rec.extrato_bancario_id;
    END IF;
    IF v_rec.contrato_registradora IS NOT NULL THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: recebível % pertence a lote de antecipação (contrato %); use fin_vincular_lote_antecipacao',
        v_rec.id, v_rec.contrato_registradora;
    END IF;
    IF v_rec.filial_id IS NULL THEN
      v_tem_filial_compartilhada := true;
    ELSIF NOT (v_rec.filial_id = ANY (v_filiais_distintas)) THEN
      v_filiais_distintas := v_filiais_distintas || v_rec.filial_id;
    END IF;

    v_liquido := v_liquido + COALESCE(
      v_rec.valor_liquido_parcela,
      v_rec.valor_liquido,
      COALESCE(v_rec.valor_parcela, v_rec.valor_venda) - abs(COALESCE(v_rec.descontos, 0)),
      0
    );
  END LOOP;

  IF coalesce(array_length(v_filiais_distintas, 1), 0) > 1
     AND NOT v_tem_filial_compartilhada THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato e recebíveis de filiais diferentes não podem ser vinculados juntos';
  END IF;

  v_delta := v_ext.valor - v_liquido;
  -- Discrepância sinalizada sem bloquear (plano Fase 3): tesoureiro escolheu.
  IF abs(v_delta) > 0.01 THEN
    v_warnings := v_warnings || format(
      'discrepância líquido Getnet (%s) vs extrato (%s): delta=%s',
      v_liquido, v_ext.valor, v_delta);
  END IF;

  UPDATE public.getnet_recebivel_lancamentos
     SET extrato_bancario_id = p_extrato_bancario_id
   WHERE id = ANY (v_ids);

  UPDATE public.extratos_bancarios
     SET reconciliado = true
   WHERE id = p_extrato_bancario_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_vincular_venda_banco_getnet', 'extratos_bancarios', p_extrato_bancario_id,
    jsonb_build_object(
      'recebivel_ids', to_jsonb(v_ids),
      'valor_liquido', v_liquido,
      'valor_extrato', v_ext.valor,
      'delta_valor', v_delta,
      'tipo_match', 'venda_banco_getnet'
    ),
    jsonb_build_object(
      'ok', true,
      'warnings', to_jsonb(v_warnings)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_extrato_bancario_id,
    'recebivel_ids', to_jsonb(v_ids),
    'valor_liquido', v_liquido,
    'valor_extrato', v_ext.valor,
    'delta_valor', v_delta,
    'warnings', to_jsonb(v_warnings)
  );
END;
$$;

COMMENT ON FUNCTION public.fin_vincular_venda_banco_getnet(uuid, uuid[], jsonb) IS
  'Fase 3 Conciliação Cartão Getnet (Hop 1): vincula recebíveis sem antecipação ao crédito bancário, grava extrato_bancario_id, marca reconciliado=true. Recusa extrato já em getnet_antecipacao_lotes, extrato com origem do espelho Getnet (C2-7 — não é crédito bancário real). Discrepância de valor vira warning (não bloqueia). has_filial_access no extrato e em cada recebível; filial mista só com âncora compartilhada (guardrail #13). Não chama fin_confirmar_conciliacao.';

-- ─── 3. Candidatos antecipação (leitura) — exclui origem espelho ───────────
CREATE OR REPLACE FUNCTION public.fin_gerar_candidatos_lote_antecipacao_getnet(
  p_lote_id uuid,
  p_contexto jsonb DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_limite integer DEFAULT 100
)
RETURNS TABLE(
  extrato_id uuid,
  data_transacao date,
  descricao text,
  valor numeric,
  score numeric,
  features jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_lote public.getnet_antecipacao_lotes%ROWTYPE;
  v_ancora date;
  v_valor numeric(14,2);
  v_limite int;
  v_busca text;
BEGIN
  IF p_lote_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_lote_id é obrigatório';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_busca := NULLIF(btrim(COALESCE(p_busca, '')), '');

  SELECT * INTO v_lote
    FROM public.getnet_antecipacao_lotes
   WHERE id = p_lote_id;

  IF v_lote.id IS NULL OR v_lote.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lote % fora do tenant ou inexistente', p_lote_id;
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_lote.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do lote';
  END IF;
  IF v_lote.status = 'lancamento_criado' THEN
    RAISE EXCEPTION 'FIN_JA_LANCADO: lote já tem deságio lançado; não há candidatos de vínculo';
  END IF;

  v_ancora := v_lote.data_contratacao_contrato;
  v_valor := v_lote.valor_atual_contrato;

  -- Com janela de data: teto alto (janela ±5/+30 é estreita — o client antigo
  -- paginava tudo nela). Sem âncora: teto baixo (só score≥15 / busca).
  IF v_ancora IS NOT NULL THEN
    v_limite := GREATEST(1, LEAST(COALESCE(NULLIF(p_limite, 0), 5000), 5000));
  ELSE
    v_limite := GREATEST(1, LEAST(COALESCE(NULLIF(p_limite, 0), 100), 500));
  END IF;

  RETURN QUERY
  WITH
  base AS (
    SELECT
      e.id,
      e.data_transacao,
      e.descricao,
      e.valor,
      e.filial_id,
      lower(COALESCE(e.descricao, '')) AS desc_l
    FROM public.extratos_bancarios e
   WHERE e.igreja_id = v_igreja
     AND e.tipo = 'credito'
     AND e.reconciliado IS NOT TRUE
     -- C2-7: mesma razão do Hop 1 — o espelho sintético do próprio Getnet
     -- não é o crédito bancário real da antecipação (e o texto "Getnet
     -- RV/PG ..." do espelho até pontuava +40 no match de texto abaixo,
     -- então sem este filtro o próprio espelho era o candidato favorito).
     -- `origem IS NULL OR ...` — mesmo achado do code-review do Hop 1
     -- acima (guardrail §9.62 item 3: NOT IN some NULL não é TRUE).
     AND (e.origem IS NULL OR NOT public.fin_e_espelho_getnet(e.origem))
     AND public.has_filial_access(v_igreja, e.filial_id)
     -- Espelha fin_vincular_lote_antecipacao: lote com filial concreta
     -- exige extrato da MESMA filial (NULL IS DISTINCT FROM A → writer
     -- rejeita; não sugerir o que o writer recusa — §9.65/§9.78/§9.79).
     AND (
       v_lote.filial_id IS NULL
       OR e.filial_id = v_lote.filial_id
     )
     -- Janela ±5/+30 em torno da contratação; sem âncora = histórico (filtrado por score/busca).
     AND (
       v_ancora IS NULL
       OR e.data_transacao BETWEEN (v_ancora - 5) AND (v_ancora + 30)
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.getnet_antecipacao_lotes l
        WHERE l.extrato_bancario_id = e.id
          AND l.id IS DISTINCT FROM p_lote_id
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.getnet_recebivel_lancamentos g
        WHERE g.extrato_bancario_id = e.id
     )
     AND (
       v_busca IS NULL
       OR e.descricao ILIKE '%' || v_busca || '%'
     )
  ),
  pontuados AS (
    SELECT
      b.id,
      b.data_transacao,
      b.descricao,
      b.valor,
      b.filial_id,
      (
        CASE
          WHEN b.desc_l LIKE '%antecipa%' OR b.desc_l LIKE '%getnet%' THEN 40
          ELSE 0
        END
        + CASE
            WHEN v_ancora IS NULL THEN 0
            WHEN b.data_transacao = v_ancora THEN 30
            WHEN abs(b.data_transacao - v_ancora) <= 3 THEN 20
            WHEN abs(b.data_transacao - v_ancora) <= 10 THEN 10
            ELSE 0
          END
        + CASE
            WHEN v_valor IS NULL THEN 0
            WHEN abs(b.valor - v_valor) <= 1 THEN 30
            WHEN v_valor <> 0 AND abs(b.valor - v_valor) / abs(v_valor) <= 0.2 THEN 15
            ELSE 0
          END
      )::numeric AS score
    FROM base b
  )
  SELECT
    p.id AS extrato_id,
    p.data_transacao,
    p.descricao,
    p.valor,
    p.score,
    jsonb_build_object(
      'filial_extrato', p.filial_id,
      'data_ancora', v_ancora,
      'valor_esperado', v_valor,
      'delta_dias', CASE WHEN v_ancora IS NULL THEN NULL ELSE (p.data_transacao - v_ancora) END,
      'delta_valor', CASE WHEN v_valor IS NULL THEN NULL ELSE (p.valor - v_valor) END,
      'match_texto', (lower(COALESCE(p.descricao, '')) LIKE '%antecipa%'
                      OR lower(COALESCE(p.descricao, '')) LIKE '%getnet%')
    ) AS features
  FROM pontuados p
  -- Sem âncora e sem busca: só quem pontuou (evita dump do histórico inteiro).
  WHERE v_ancora IS NOT NULL
     OR v_busca IS NOT NULL
     OR p.score >= 15
  ORDER BY p.score DESC, p.data_transacao DESC, p.id
  LIMIT v_limite;
END;
$$;

COMMENT ON FUNCTION public.fin_gerar_candidatos_lote_antecipacao_getnet(uuid, jsonb, text, integer) IS
  'Fase 5 Conciliação Cartão Getnet (só leitura): sugere créditos bancários REAIS pra vincular a um lote de antecipação (C2-7: exclui origem getnet_sftp_txt/getnet_sftp_tipo5 — o espelho sintético do próprio Getnet não é um crédito bancário). Score 0..100 (texto/data/valor). Exclui extratos em outro lote, Hop 1 ou reconciliado. Lote com filial concreta exige extrato da mesma filial (espelha fin_vincular_lote_antecipacao). has_filial_access no lote e em cada extrato. Confirmação continua manual.';

-- ─── 4. Vincular antecipação (escrita) — rejeita espelho ───────────────────
CREATE OR REPLACE FUNCTION public.fin_vincular_lote_antecipacao(
  p_lote_id uuid,
  p_extrato_bancario_id uuid,
  p_contexto jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_lote public.getnet_antecipacao_lotes%ROWTYPE;
  v_extrato record;
  v_extrato_atual_filial uuid;
  v_desagio numeric;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_lote FROM public.getnet_antecipacao_lotes
   WHERE id = p_lote_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF v_lote.id IS NULL THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lote % fora do tenant ou inexistente', p_lote_id;
  END IF;
  IF v_lote.status = 'lancamento_criado' THEN
    RAISE EXCEPTION 'FIN_JA_LANCADO: lote já tem deságio lançado (%); não é possível trocar o vínculo', v_lote.lancamento_desagio_id;
  END IF;

  -- Lock do extrato (mesmo padrão Hop 1): checagens de ocupação depois do
  -- lock, em statement nova — snapshot fresco sob READ COMMITTED.
  SELECT id, igreja_id, filial_id, valor, data_transacao, tipo, reconciliado, origem
    INTO v_extrato
    FROM public.extratos_bancarios
   WHERE id = p_extrato_bancario_id
   ORDER BY id
   FOR NO KEY UPDATE;

  IF v_extrato.id IS NULL OR v_extrato.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: extrato bancário inexistente ou fora do tenant';
  END IF;
  IF v_extrato.tipo <> 'credito' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato bancário selecionado não é um crédito';
  END IF;
  -- C2-7: mesma razão do Hop 1 — o espelho sintético do próprio Getnet não
  -- é o crédito bancário real que liquidou a antecipação.
  IF public.fin_e_espelho_getnet(v_extrato.origem) THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato é o espelho sintético do próprio Getnet, não um crédito bancário real — use um crédito com origem do banco';
  END IF;

  -- Direção contrária do double-booking Fase 3: Hop 1 marca reconciliado=true
  -- e/ou grava getnet_recebivel_lancamentos.extrato_bancario_id.
  IF v_extrato.reconciliado IS TRUE THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato já reconciliado';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.getnet_recebivel_lancamentos g
     WHERE g.extrato_bancario_id = p_extrato_bancario_id
  ) THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato já vinculado a vendas Getnet (Hop 1)';
  END IF;

  -- Achado Codex P1 (mesma classe já corrigida no diagnóstico/desfazer
  -- desta migration — proativo aqui porque esta função já está sendo
  -- reescrita nesta migration por outro motivo, guardrail B.9): COALESCE
  -- só valida UMA filial concreta quando lote e extrato NOVO têm filiais
  -- diferentes. O guard de linha ~724 abaixo já rejeita esse caso pro
  -- link NOVO (então o risco aqui é baixo — não vaza dado, só rejeita
  -- tarde), mas troca por 2 checagens independentes por consistência.
  IF NOT public.has_filial_access(v_igreja, v_lote.filial_id)
     OR NOT public.has_filial_access(v_igreja, v_extrato.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste vínculo';
  END IF;

  -- §9.68: revincular (trocar um extrato JÁ vinculado por outro) exige
  -- acesso à filial do vínculo ATUAL também, não só do novo. Este É o
  -- caso de risco real: o vínculo ATUAL pode ser um descompasso
  -- histórico (lote filial A, extrato atual filial B — criado antes do
  -- guard de linha ~724 existir), e o COALESCE só validava A, permitindo
  -- revincular (removendo o vínculo com B) sem nunca provar acesso a B.
  IF v_lote.extrato_bancario_id IS NOT NULL
     AND v_lote.extrato_bancario_id IS DISTINCT FROM p_extrato_bancario_id THEN
    SELECT filial_id INTO v_extrato_atual_filial
      FROM public.extratos_bancarios WHERE id = v_lote.extrato_bancario_id;
    IF NOT public.has_filial_access(v_igreja, v_lote.filial_id)
       OR NOT public.has_filial_access(v_igreja, v_extrato_atual_filial) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do vínculo atual deste lote';
    END IF;
  END IF;

  -- Lote com filial definida só pode vincular a extrato da mesma filial
  -- (filial NULL no lote = lote global, aceita qualquer extrato do tenant).
  IF v_lote.filial_id IS NOT NULL
     AND v_extrato.filial_id IS DISTINCT FROM v_lote.filial_id THEN
    RAISE EXCEPTION 'FIN_TENANT: extrato bancário pertence a outra filial (lote é da filial %)', v_lote.filial_id;
  END IF;

  -- Fast-path: cobre o caso comum (sem corrida) sem esperar o banco rejeitar.
  -- Quem garante de verdade contra corrida concorrente é o índice único
  -- parcial (getnet_antecipacao_lotes_extrato_unique) + o handler abaixo.
  IF EXISTS (
    SELECT 1 FROM public.getnet_antecipacao_lotes
     WHERE extrato_bancario_id = p_extrato_bancario_id AND id <> p_lote_id
  ) THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato bancário já vinculado a outro lote de antecipação';
  END IF;

  BEGIN
    UPDATE public.getnet_antecipacao_lotes
       SET extrato_bancario_id = p_extrato_bancario_id,
           status = 'vinculado',
           updated_at = now()
     WHERE id = p_lote_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato bancário já vinculado a outro lote de antecipação';
  END;

  v_desagio := COALESCE(v_lote.valor_atual_contrato, 0) - v_extrato.valor;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_vincular_lote_antecipacao', 'getnet_antecipacao_lotes', p_lote_id,
    jsonb_build_object('extrato_bancario_id', p_extrato_bancario_id),
    jsonb_build_object('desagio', v_desagio, 'extrato_valor', v_extrato.valor,
                       'extrato_data', v_extrato.data_transacao));

  RETURN jsonb_build_object('ok', true, 'id', p_lote_id,
                            'desagio', v_desagio,
                            'warnings', '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.fin_vincular_lote_antecipacao(uuid, uuid, jsonb) IS
  'Vincula lote de antecipação Getnet a crédito bancário. Recusa extrato já reconciliado, já usado pelo Hop 1, ou com origem do espelho Getnet (C2-7 — não é crédito bancário real) — fecha double-booking bidirecional com fin_vincular_venda_banco_getnet. has_filial_access no vínculo novo e no atual (§9.68).';

-- ─── 5. Diagnóstico (leitura) — vínculos históricos apontando pro espelho ──
-- Não corrige nada sozinho: lista pra o tesoureiro decidir (plano C2-7
-- original: "decidir se são reapontadas... e o que acontece com casos sem
-- correspondência ainda" — decisão do usuário, não automação silenciosa).
CREATE OR REPLACE FUNCTION public.fin_diagnosticar_vinculos_getnet_espelho(
  p_integracao_id uuid DEFAULT NULL,
  p_contexto jsonb DEFAULT NULL
)
RETURNS TABLE(
  tipo text,
  vinculo_id uuid,
  extrato_bancario_id uuid,
  origem_extrato text,
  valor_extrato numeric,
  data_extrato date,
  filial_id uuid,
  detalhe jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  IF p_integracao_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.integracoes_financeiras i
       WHERE i.id = p_integracao_id AND i.igreja_id = v_igreja
    ) THEN
      RAISE EXCEPTION 'FIN_FK: integração inexistente ou fora do tenant';
    END IF;
  END IF;

  RETURN QUERY
  -- Hop 1: agrupa por extrato (vários recebíveis podem apontar pro mesmo).
  SELECT
    'hop1'::text AS tipo,
    e.id AS vinculo_id,
    e.id AS extrato_bancario_id,
    e.origem AS origem_extrato,
    e.valor AS valor_extrato,
    e.data_transacao AS data_extrato,
    e.filial_id,
    jsonb_build_object(
      'recebivel_ids', jsonb_agg(g.id ORDER BY g.id),
      'valor_liquido_recebiveis', SUM(COALESCE(
        g.valor_liquido_parcela, g.valor_liquido,
        COALESCE(g.valor_parcela, g.valor_venda) - abs(COALESCE(g.descontos, 0)), 0)),
      -- Postgres não tem MIN/MAX nativo pra uuid — cast pra text e volta.
      'integracao_id', min(g.integracao_id::text)::uuid
    ) AS detalhe
  FROM public.getnet_recebivel_lancamentos g
  JOIN public.extratos_bancarios e ON e.id = g.extrato_bancario_id
 WHERE g.igreja_id = v_igreja
   AND public.fin_e_espelho_getnet(e.origem)
   AND (p_integracao_id IS NULL OR g.integracao_id = p_integracao_id)
   -- Achado Codex P1 + Bugbot (mesmo padrão do fix em
   -- fin_desfazer_vinculo_venda_banco_getnet): extrato compartilhado
   -- (filial_id NULL) passa no check de filial pra qualquer chamador,
   -- mas os recebíveis vinculados podem ser de uma filial específica —
   -- checa a do extrato E a de CADA recebível, não só a do extrato.
   AND public.has_filial_access(v_igreja, e.filial_id)
   AND public.has_filial_access(v_igreja, g.filial_id)
 GROUP BY e.id, e.origem, e.valor, e.data_transacao, e.filial_id

  UNION ALL

  -- Antecipação: 1 lote = 1 vínculo.
  SELECT
    'antecipacao'::text AS tipo,
    l.id AS vinculo_id,
    e.id AS extrato_bancario_id,
    e.origem AS origem_extrato,
    e.valor AS valor_extrato,
    e.data_transacao AS data_extrato,
    e.filial_id,
    jsonb_build_object(
      'contrato_registradora', l.contrato_registradora,
      'valor_atual_contrato', l.valor_atual_contrato,
      'status', l.status,
      'integracao_id', l.integracao_id
    ) AS detalhe
  FROM public.getnet_antecipacao_lotes l
  JOIN public.extratos_bancarios e ON e.id = l.extrato_bancario_id
 WHERE l.igreja_id = v_igreja
   AND public.fin_e_espelho_getnet(e.origem)
   AND (p_integracao_id IS NULL OR l.integracao_id = p_integracao_id)
   -- Achado Codex P1 (2ª rodada) — o COALESCE original só validava UMA
   -- filial concreta quando as duas eram definidas: um lote legado com
   -- filial A cujo extrato espelho tem filial B (a migration original
   -- que criava esse vínculo, `20260729170000_fin_lote_antecipacao_
   -- vinculo_desagio.sql`, nunca comparava as duas — histórico real
   -- pode ter esse descompasso, mesmo com escritas atuais já validando)
   -- vazava os dados do extrato (valor/data/origem/id) pra quem só tem
   -- acesso à filial A. Checa as duas filiais INDEPENDENTEMENTE — cada
   -- has_filial_access já trata NULL como "sem restrição" sozinho, então
   -- isso não regride o caso comum (uma das duas NULL), só fecha o caso
   -- em que as duas são concretas e diferentes.
   AND public.has_filial_access(v_igreja, l.filial_id)
   AND public.has_filial_access(v_igreja, e.filial_id)

  -- Achado do code-review: `ORDER BY 5` era posicional e caía na 5ª
  -- coluna (valor_extrato), não na intenção (mais recente primeiro) —
  -- nome explícito evita a mesma armadilha se a lista de colunas mudar.
  ORDER BY data_extrato DESC;
END;
$$;

COMMENT ON FUNCTION public.fin_diagnosticar_vinculos_getnet_espelho(uuid, jsonb) IS
  'C2-7, só leitura: lista vínculos Hop1/antecipação JÁ confirmados que apontam pro espelho sintético do próprio Getnet (origem getnet_sftp_txt/getnet_sftp_tipo5) em vez de um crédito bancário real — ficaram assim porque fin_gerar_candidatos_venda_banco_getnet/fin_gerar_candidatos_lote_antecipacao_getnet não filtravam origem antes desta migration. Não corrige nada — só lista, pra o tesoureiro decidir (usar fin_desfazer_vinculo_venda_banco_getnet/fin_desfazer_vinculo_lote_antecipacao pra desfazer e revincular pelo fluxo normal, já corrigido).';

GRANT EXECUTE ON FUNCTION public.fin_diagnosticar_vinculos_getnet_espelho(uuid, jsonb)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_diagnosticar_vinculos_getnet_espelho(uuid, jsonb)
  FROM anon;

-- ─── 6. Desfazer Hop 1 (escrita) — não existia nenhum mecanismo até agora ──
CREATE OR REPLACE FUNCTION public.fin_desfazer_vinculo_venda_banco_getnet(
  p_extrato_bancario_id uuid,
  p_contexto jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_ext public.extratos_bancarios%ROWTYPE;
  v_rec record;
  v_recebivel_ids uuid[] := '{}';
BEGIN
  IF p_extrato_bancario_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_extrato_bancario_id é obrigatório';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_ext
    FROM public.extratos_bancarios
   WHERE id = p_extrato_bancario_id
   ORDER BY id
   FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: extrato % inexistente', p_extrato_bancario_id;
  END IF;
  IF v_ext.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_TENANT: extrato fora do tenant';
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_ext.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do extrato';
  END IF;

  -- Trava + valida filial de cada recebível num loop só — diferente de
  -- fin_vincular_venda_banco_getnet (que separa lock de `count(*)` porque
  -- agregação não pode ir junto de FOR NO KEY UPDATE), aqui não há
  -- agregado nenhum: o cursor do FOR já pode carregar o lock direto
  -- (achado do code-review — a 1ª versão copiava o padrão de 2 statements
  -- sem essa distinção, escaneando a tabela 2x à toa).
  --
  -- Achado do code-review: um extrato COMPARTILHADO (filial_id NULL) passa
  -- no check de filial acima pra qualquer chamador — mas os recebíveis
  -- vinculados podem ser de uma filial específica que o chamador não tem
  -- acesso. fin_vincular_venda_banco_getnet valida CADA recebível, não só
  -- o extrato; o desfazer precisa da mesma checagem, senão um usuário
  -- restrito a uma filial consegue desvincular (e reverter reconciliado)
  -- de recebíveis de outra filial via um extrato compartilhado.
  FOR v_rec IN
    SELECT g.id, g.filial_id
      FROM public.getnet_recebivel_lancamentos g
     WHERE g.extrato_bancario_id = p_extrato_bancario_id
     ORDER BY g.id
     FOR NO KEY UPDATE
  LOOP
    IF NOT public.has_filial_access(v_igreja, v_rec.filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do recebível %', v_rec.id;
    END IF;
    v_recebivel_ids := array_append(v_recebivel_ids, v_rec.id);
  END LOOP;

  IF coalesce(array_length(v_recebivel_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato não tem vínculo Hop 1 pra desfazer';
  END IF;

  UPDATE public.getnet_recebivel_lancamentos
     SET extrato_bancario_id = NULL
   WHERE extrato_bancario_id = p_extrato_bancario_id;

  UPDATE public.extratos_bancarios
     SET reconciliado = false
   WHERE id = p_extrato_bancario_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_desfazer_vinculo_venda_banco_getnet', 'extratos_bancarios', p_extrato_bancario_id,
    jsonb_build_object('recebivel_ids', to_jsonb(v_recebivel_ids)),
    jsonb_build_object('ok', true)
  );

  RETURN jsonb_build_object('ok', true, 'id', p_extrato_bancario_id,
                            'recebivel_ids', to_jsonb(v_recebivel_ids));
END;
$$;

COMMENT ON FUNCTION public.fin_desfazer_vinculo_venda_banco_getnet(uuid, jsonb) IS
  'C2-7: desfaz um vínculo Hop 1 (getnet_recebivel_lancamentos.extrato_bancario_id + extratos_bancarios.reconciliado) — não existia nenhum mecanismo de desfazer antes desta migration. Uso principal: remediar vínculos históricos que apontam pro espelho Getnet (ver fin_diagnosticar_vinculos_getnet_espelho), depois re-vincular pelo fluxo normal (candidatos já corrigidos). has_filial_access no extrato.';

GRANT EXECUTE ON FUNCTION public.fin_desfazer_vinculo_venda_banco_getnet(uuid, jsonb)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_desfazer_vinculo_venda_banco_getnet(uuid, jsonb)
  FROM anon;

-- ─── 7. Desfazer antecipação (escrita) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fin_desfazer_vinculo_lote_antecipacao(
  p_lote_id uuid,
  p_contexto jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_lote public.getnet_antecipacao_lotes%ROWTYPE;
  v_extrato_id uuid;
BEGIN
  IF p_lote_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_lote_id é obrigatório';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  -- FOR NO KEY UPDATE, não FOR UPDATE (achado do code-review, guardrail
  -- D.2): o UPDATE abaixo só toca extrato_bancario_id/status/updated_at,
  -- nunca a PK — lock mais fraco que resolve o problema, evita conflito
  -- desnecessário com um INSERT concorrente de filho referenciando este
  -- lote (mesma classe de bug do §9.55 citada no guardrail).
  SELECT * INTO v_lote FROM public.getnet_antecipacao_lotes
   WHERE id = p_lote_id AND igreja_id = v_igreja
   FOR NO KEY UPDATE;
  IF v_lote.id IS NULL THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lote % fora do tenant ou inexistente', p_lote_id;
  END IF;
  IF v_lote.status = 'lancamento_criado' THEN
    RAISE EXCEPTION 'FIN_JA_LANCADO: lote já tem deságio lançado (%); não é possível desfazer o vínculo — reverta o lançamento primeiro', v_lote.lancamento_desagio_id;
  END IF;
  IF v_lote.extrato_bancario_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: lote não tem vínculo pra desfazer';
  END IF;
  -- Achado Codex P1 (mesma classe do fix no diagnóstico, 3ª rodada): o
  -- COALESCE só validava UMA filial concreta quando lote e extrato têm
  -- filiais diferentes (vínculo histórico criado antes de qualquer
  -- validação de match — 20260729170000_fin_lote_antecipacao_vinculo_
  -- desagio.sql nunca comparava as duas). Um caller restrito à filial do
  -- lote conseguia desfazer o vínculo (e receber o extrato_bancario_id
  -- de volta) de um extrato de OUTRA filial sem acesso a ela. Duas
  -- checagens independentes, não COALESCE.
  IF NOT public.has_filial_access(v_igreja, v_lote.filial_id)
     OR NOT public.has_filial_access(v_igreja, (
       SELECT filial_id FROM public.extratos_bancarios WHERE id = v_lote.extrato_bancario_id
     )) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste vínculo';
  END IF;

  v_extrato_id := v_lote.extrato_bancario_id;

  UPDATE public.getnet_antecipacao_lotes
     SET extrato_bancario_id = NULL,
         status = 'pendente_vinculo',
         updated_at = now()
   WHERE id = p_lote_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_desfazer_vinculo_lote_antecipacao', 'getnet_antecipacao_lotes', p_lote_id,
    jsonb_build_object('extrato_bancario_id_anterior', v_extrato_id),
    jsonb_build_object('ok', true)
  );

  RETURN jsonb_build_object('ok', true, 'id', p_lote_id,
                            'extrato_bancario_id_anterior', v_extrato_id);
END;
$$;

COMMENT ON FUNCTION public.fin_desfazer_vinculo_lote_antecipacao(uuid, jsonb) IS
  'C2-7: desfaz o vínculo de um lote de antecipação (extrato_bancario_id + volta status pra pendente_vinculo) — recusa se já tem deságio lançado. Não existia nenhum mecanismo de desfazer antes desta migration. Uso principal: remediar vínculos históricos que apontam pro espelho Getnet (ver fin_diagnosticar_vinculos_getnet_espelho). has_filial_access no vínculo atual.';

GRANT EXECUTE ON FUNCTION public.fin_desfazer_vinculo_lote_antecipacao(uuid, jsonb)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_desfazer_vinculo_lote_antecipacao(uuid, jsonb)
  FROM anon;

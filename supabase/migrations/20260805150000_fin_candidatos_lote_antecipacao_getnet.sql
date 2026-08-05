-- ============================================================================
-- Fase 5 — Conciliação Cartão Getnet: sugestão de crédito pro lote de
-- antecipação (só leitura). Confirmação continua manual via
-- fin_vincular_lote_antecipacao.
--
-- Substitui o read-path client `.from("extratos_bancarios")` de
-- VincularExtratoLoteDialog (RLS de extratos ainda frágil de filial;
-- plano exige SECURITY DEFINER + has_filial_access).
--
-- Exclui créditos já tomados por outro lote, por Hop 1
-- (getnet_recebivel_lancamentos.extrato_bancario_id) ou reconciliado=true.
-- Score espelha a heurística UI legada (texto / data / valor), 0..100.
-- ============================================================================

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
  v_limite := GREATEST(1, LEAST(COALESCE(p_limite, 100), 500));
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
     AND public.has_filial_access(v_igreja, e.filial_id)
     -- Filial do lote concreta → só mesma filial (ou extrato global).
     AND (
       v_lote.filial_id IS NULL
       OR e.filial_id IS NULL
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
  'Fase 5 Conciliação Cartão Getnet (só leitura): sugere créditos bancários pra vincular a um lote de antecipação. Score 0..100 (texto/data/valor). Exclui extratos em outro lote, Hop 1 ou reconciliado. has_filial_access no lote e em cada extrato. Confirmação continua manual (fin_vincular_lote_antecipacao).';

GRANT EXECUTE ON FUNCTION public.fin_gerar_candidatos_lote_antecipacao_getnet(uuid, jsonb, text, integer)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_gerar_candidatos_lote_antecipacao_getnet(uuid, jsonb, text, integer)
  FROM anon;

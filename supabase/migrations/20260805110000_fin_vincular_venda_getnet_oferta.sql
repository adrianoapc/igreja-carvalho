-- ============================================================================
-- Fase 2 — Conciliação Cartão Getnet: Hop 2 confirmação
-- (fin_vincular_venda_getnet_oferta) + Fase 2b (parcelado).
--
-- Fecha o vínculo Oferta ↔ Venda: grava transacao_financeira_id nos
-- recebíveis, atualiza taxa/líquido/data/status da oferta via
-- fin_atualizar_lancamento, marca conciliacao_status='conciliado_manual'.
--
-- Fase 2b: se os p_recebivel_ids cobrem N>1 parcelas do mesmo NSU
-- (ex. "1 de 7".."7 de 7"), o lançamento original vira parcela 1/N e as
-- irmãs 2..N nascem com lancamento_pai_id = original (1:1 por linha CSV).
-- Exige o conjunto completo 1..N presente; parcial → FIN_VALIDACAO.
--
-- CSV real: valor_venda repete o bruto — taxas/líquido vêm de
-- descontos / valor_liquido_parcela / valor_parcela por linha.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fin_vincular_venda_getnet_oferta(
  p_transacao_id uuid,
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
  v_trx public.transacoes_financeiras%ROWTYPE;
  v_pai uuid;
  v_pai_novo uuid;
  v_rec record;
  v_ids uuid[];
  v_n int;
  v_taxas numeric(14,2) := 0;
  v_liquido numeric(14,2) := 0;
  v_bruto_nsu numeric(14,2);
  v_data_pag date;
  v_patch jsonb;
  v_res jsonb;
  v_warnings text[] := '{}';
  v_nsu text;
  v_nsu_count int;
  v_total_parcelas int;
  v_max_parcela int;
  v_min_parcela int;
  v_n_distintas int;
  v_parcelado boolean := false;
  v_linha record;
  v_nova_id uuid;
  v_filhas uuid[] := '{}';
  v_desc_base text;
  v_competencia date;
  v_filiais_distintas uuid[] := '{}';
  v_tem_filial_compartilhada boolean := false;
BEGIN
  IF p_transacao_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_transacao_id é obrigatório';
  END IF;
  IF p_recebivel_ids IS NULL OR coalesce(array_length(p_recebivel_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_recebivel_ids não pode ser vazio';
  END IF;

  -- Deduplica ids preservando ordem determinística pro lock.
  SELECT array_agg(DISTINCT x ORDER BY x) INTO v_ids
    FROM unnest(p_recebivel_ids) AS x;
  IF coalesce(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_recebivel_ids não pode ser vazio';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  -- Lock oferta + recebíveis em ordem de id (evita deadlock).
  SELECT * INTO v_trx
    FROM public.transacoes_financeiras
   WHERE id = p_transacao_id
   ORDER BY id
   FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % inexistente', p_transacao_id;
  END IF;
  IF v_trx.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_TENANT: lançamento fora do tenant';
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_trx.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do lançamento';
  END IF;
  IF v_trx.tipo IS DISTINCT FROM 'entrada' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: Hop 2 só vincula ofertas (tipo=entrada)';
  END IF;
  IF v_trx.status = 'cancelado' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: lançamento cancelado';
  END IF;
  IF v_trx.conciliacao_status IS DISTINCT FROM 'nao_conciliado' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: lançamento já conciliado (% )', v_trx.conciliacao_status;
  END IF;

  -- Âncora de filial: oferta entra no conjunto (guardrail #13 / §9.86).
  IF v_trx.filial_id IS NULL THEN
    v_tem_filial_compartilhada := true;
  ELSE
    v_filiais_distintas := ARRAY[v_trx.filial_id];
  END IF;

  -- Trava recebíveis.
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

  -- Valida cada recebível (tenant / filial / ainda livre / venda real).
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
    IF v_rec.filial_id IS NULL THEN
      v_tem_filial_compartilhada := true;
    ELSIF NOT (v_rec.filial_id = ANY (v_filiais_distintas)) THEN
      v_filiais_distintas := v_filiais_distintas || v_rec.filial_id;
    END IF;
    IF v_rec.transacao_financeira_id IS NOT NULL THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: recebível % já vinculado a %',
        v_rec.id, v_rec.transacao_financeira_id;
    END IF;
    IF v_rec.nsu IS NULL OR v_rec.nsu = '' OR v_rec.valor_venda IS NULL THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: recebível % não é linha de venda (nsu/valor_venda)',
        v_rec.id;
    END IF;
  END LOOP;

  -- Filial mista: rejeita ≥2 filiais concretas sem âncora compartilhada
  -- (filial_id IS NULL). Mesma regra de fin_confirmar_conciliacao (§9.86).
  IF coalesce(array_length(v_filiais_distintas, 1), 0) > 1
     AND NOT v_tem_filial_compartilhada THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: oferta e recebíveis de filiais diferentes não podem ser vinculados juntos';
  END IF;

  -- Detecta parcelado: um único NSU com total N>1 e rótulos "k de N".
  SELECT count(DISTINCT g.nsu) INTO v_nsu_count
    FROM public.getnet_recebivel_lancamentos g
   WHERE g.id = ANY (v_ids);

  IF v_nsu_count = 1 THEN
    SELECT g.nsu,
           MAX(g.valor_venda),
           MAX((regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[2]::int),
           MIN((regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int),
           MAX((regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int),
           count(DISTINCT COALESCE(g.parcelas, '1 de 1'))
      INTO v_nsu, v_bruto_nsu, v_total_parcelas, v_min_parcela, v_max_parcela, v_n_distintas
      FROM public.getnet_recebivel_lancamentos g
     WHERE g.id = ANY (v_ids)
     GROUP BY g.nsu;

    v_parcelado := COALESCE(v_total_parcelas, 1) > 1;
  ELSIF v_nsu_count > 1 THEN
    -- Vários NSUs: só à vista (todas total 1). Misturar com parcelado N>1
    -- no mesmo vínculo é ambíguo.
    IF EXISTS (
      SELECT 1
        FROM public.getnet_recebivel_lancamentos g
       WHERE g.id = ANY (v_ids)
         AND COALESCE((regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[2]::int, 1) > 1
    ) THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: não misture NSU parcelado (N>1) com outros NSUs no mesmo vínculo';
    END IF;
    v_parcelado := false;
  END IF;

  IF v_parcelado THEN
    -- 2b: conjunto completo 1..N obrigatório.
    IF v_n_distintas IS DISTINCT FROM v_total_parcelas
       OR v_min_parcela IS DISTINCT FROM 1
       OR v_max_parcela IS DISTINCT FROM v_total_parcelas
       OR array_length(v_ids, 1) IS DISTINCT FROM v_total_parcelas THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: parcelas incompletas do NSU % (recebidos %, esperado 1..%)',
        v_nsu, array_length(v_ids, 1), v_total_parcelas;
    END IF;

    -- Lock de grupo (raiz = própria oferta, ainda unico).
    v_pai := p_transacao_id;
    PERFORM 1
      FROM public.transacoes_financeiras t
     WHERE t.id = v_pai OR t.lancamento_pai_id = v_pai
     ORDER BY t.id
     FOR NO KEY UPDATE;

    -- Re-resolve (padrão §9.72–§9.77): se já tinha pai, sobe.
    SELECT COALESCE(t.lancamento_pai_id, t.id) INTO v_pai_novo
      FROM public.transacoes_financeiras t WHERE t.id = p_transacao_id;
    IF v_pai_novo IS DISTINCT FROM v_pai THEN
      v_pai := v_pai_novo;
      PERFORM 1
        FROM public.transacoes_financeiras t
       WHERE t.id = v_pai OR t.lancamento_pai_id = v_pai
       ORDER BY t.id
       FOR NO KEY UPDATE;
    END IF;

    IF v_pai IS DISTINCT FROM p_transacao_id THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: lançamento já pertence a um grupo parcelado; Hop 2 espera a raiz';
    END IF;

    v_desc_base := regexp_replace(v_trx.descricao, '\s*\(\d+/\d+\)\s*$', '');
    v_competencia := COALESCE(v_trx.data_competencia, v_trx.data_vencimento);

    -- Parcela 1 = linha "1 de N": atualiza a oferta original (preserva id/sessao).
    SELECT g.*,
           (regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int AS num_parc
      INTO v_linha
      FROM public.getnet_recebivel_lancamentos g
     WHERE g.id = ANY (v_ids)
       AND (regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int = 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: falta a parcela 1 de % do NSU %', v_total_parcelas, v_nsu;
    END IF;

    v_taxas := abs(COALESCE(v_linha.descontos, 0));
    v_liquido := COALESCE(v_linha.valor_liquido_parcela,
                          COALESCE(v_linha.valor_parcela, v_linha.valor_venda) - v_taxas);
    v_data_pag := v_linha.data_vencimento;

    v_patch := jsonb_build_object(
      'tipo_lancamento', 'parcelado',
      'numero_parcela', 1,
      'total_parcelas', v_total_parcelas,
      'valor', COALESCE(v_linha.valor_parcela, v_linha.valor_venda),
      'taxas_administrativas', v_taxas,
      'valor_liquido', v_liquido,
      'data_vencimento', v_linha.data_vencimento,
      'data_competencia', v_competencia,
      'data_pagamento', v_data_pag,
      'status', 'pago',
      'descricao', v_desc_base || format(' (1/%s)', v_total_parcelas)
    );

    v_res := public.fin_atualizar_lancamento(p_transacao_id, v_patch, v_ctx);
    IF COALESCE((v_res ->> 'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: falha ao atualizar parcela 1: %', v_res;
    END IF;

    UPDATE public.getnet_recebivel_lancamentos
       SET transacao_financeira_id = p_transacao_id
     WHERE id = v_linha.id;

    -- Irmãs 2..N
    FOR v_linha IN
      SELECT g.*,
             (regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int AS num_parc
        FROM public.getnet_recebivel_lancamentos g
       WHERE g.id = ANY (v_ids)
         AND (regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int > 1
       ORDER BY (regexp_match(COALESCE(g.parcelas, '1 de 1'), '(\d+)\s+de\s+(\d+)'))[1]::int, g.id
    LOOP
      v_taxas := abs(COALESCE(v_linha.descontos, 0));
      -- Mesmo fallback da parcela 1: valor_parcela → valor_venda (nunca 0).
      v_liquido := COALESCE(v_linha.valor_liquido_parcela,
                            COALESCE(v_linha.valor_parcela, v_linha.valor_venda) - v_taxas);

      INSERT INTO public.transacoes_financeiras (
        tipo, tipo_lancamento, descricao, valor, valor_liquido,
        data_vencimento, data_competencia, data_pagamento,
        conta_id, categoria_id, subcategoria_id, centro_custo_id,
        base_ministerial_id, fornecedor_id, forma_pagamento, forma_pagamento_id,
        total_parcelas, numero_parcela,
        observacoes, lancado_por, status,
        juros, multas, desconto, taxas_administrativas,
        pessoa_id, sessao_id,
        origem_registro, lancamento_pai_id, igreja_id, filial_id,
        conciliacao_status, conferido_manual
      ) VALUES (
        v_trx.tipo, 'parcelado',
        v_desc_base || format(' (%s/%s)', v_linha.num_parc, v_total_parcelas),
        COALESCE(v_linha.valor_parcela, v_linha.valor_venda),
        v_liquido,
        v_linha.data_vencimento,
        v_competencia,
        NULL,
        v_trx.conta_id, v_trx.categoria_id, v_trx.subcategoria_id, v_trx.centro_custo_id,
        v_trx.base_ministerial_id, v_trx.fornecedor_id, v_trx.forma_pagamento, v_trx.forma_pagamento_id,
        v_total_parcelas, v_linha.num_parc,
        v_trx.observacoes, v_trx.lancado_por, 'pendente',
        0, 0, 0, v_taxas,
        v_trx.pessoa_id, v_trx.sessao_id,
        COALESCE(v_trx.origem_registro, 'manual'), p_transacao_id, v_igreja, v_trx.filial_id,
        'conciliado_manual', true
      )
      RETURNING id INTO v_nova_id;

      v_filhas := v_filhas || v_nova_id;

      UPDATE public.getnet_recebivel_lancamentos
         SET transacao_financeira_id = v_nova_id
       WHERE id = v_linha.id;
    END LOOP;

    UPDATE public.transacoes_financeiras
       SET conciliacao_status = 'conciliado_manual',
           conferido_manual = true
     WHERE id = p_transacao_id;

    v_warnings := v_warnings || format(
      'Hop 2 parcelado: oferta %s virou 1/%s; criadas %s irmãs',
      p_transacao_id, v_total_parcelas, coalesce(array_length(v_filhas, 1), 0));

  ELSE
    -- ─── Caminho à vista (1 de 1 / vários NSUs à vista) ───────────────────
    SELECT COALESCE(SUM(abs(COALESCE(g.descontos, 0))), 0),
           COALESCE(SUM(COALESCE(g.valor_liquido_parcela,
                                 COALESCE(g.valor_parcela, g.valor_venda)
                                 - abs(COALESCE(g.descontos, 0)))), 0),
           MAX(g.data_vencimento)
      INTO v_taxas, v_liquido, v_data_pag
      FROM public.getnet_recebivel_lancamentos g
     WHERE g.id = ANY (v_ids);

    -- Confere bruto (1× por NSU) ≈ valor da oferta (±0,01).
    SELECT COALESCE(SUM(v), 0) INTO v_bruto_nsu
      FROM (
        SELECT MAX(g.valor_venda) AS v
          FROM public.getnet_recebivel_lancamentos g
         WHERE g.id = ANY (v_ids)
         GROUP BY g.nsu
      ) s;

    IF abs(v_bruto_nsu - v_trx.valor) > 0.01 THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: bruto Getnet (%) diverge do valor da oferta (%)',
        v_bruto_nsu, v_trx.valor;
    END IF;

    UPDATE public.getnet_recebivel_lancamentos
       SET transacao_financeira_id = p_transacao_id
     WHERE id = ANY (v_ids);

    v_patch := jsonb_build_object(
      'taxas_administrativas', v_taxas,
      'valor_liquido', v_liquido,
      'data_pagamento', v_data_pag,
      'status', 'pago'
    );

    v_res := public.fin_atualizar_lancamento(p_transacao_id, v_patch, v_ctx);
    IF COALESCE((v_res ->> 'ok')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: falha ao atualizar oferta: %', v_res;
    END IF;

    UPDATE public.transacoes_financeiras
       SET conciliacao_status = 'conciliado_manual',
           conferido_manual = true
     WHERE id = p_transacao_id;
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_vincular_venda_getnet_oferta', 'transacoes_financeiras', p_transacao_id,
    jsonb_build_object(
      'recebivel_ids', to_jsonb(v_ids),
      'parcelado', v_parcelado,
      'nsu', v_nsu,
      'total_parcelas', v_total_parcelas,
      'tipo_match', 'oferta_venda_getnet'
    ),
    jsonb_build_object(
      'ok', true,
      'filhas', to_jsonb(v_filhas),
      'taxas', v_taxas,
      'liquido', v_liquido,
      'warnings', to_jsonb(v_warnings)
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_transacao_id,
    'recebivel_ids', to_jsonb(v_ids),
    'parcelado', v_parcelado,
    'filhas', to_jsonb(v_filhas),
    'taxas_administrativas', v_taxas,
    'valor_liquido', v_liquido,
    'warnings', to_jsonb(v_warnings)
  );
END;
$$;

COMMENT ON FUNCTION public.fin_vincular_venda_getnet_oferta(uuid, uuid[], jsonb) IS
  'Fase 2 Conciliação Cartão Getnet (Hop 2): vincula recebíveis à oferta, atualiza taxa/líquido/pagamento via fin_atualizar_lancamento, marca conciliado_manual. Fase 2b: NSU com N>1 parcelas (conjunto completo) converte a oferta em parcela 1/N e cria irmãs 2..N. has_filial_access na oferta e em cada recebível; filial mista só com âncora compartilhada (guardrail #13).';

GRANT EXECUTE ON FUNCTION public.fin_vincular_venda_getnet_oferta(uuid, uuid[], jsonb)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_vincular_venda_getnet_oferta(uuid, uuid[], jsonb)
  FROM anon;

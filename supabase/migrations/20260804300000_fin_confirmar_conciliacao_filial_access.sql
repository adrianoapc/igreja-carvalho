-- ============================================================================
-- fin_confirmar_conciliacao — fecha has_filial_access (guardrail B.9) +
-- gaps de isolamento/concorrência descobertos no review desta fatia.
--
-- Contexto: listada em §9.68 de docs/arquitetura-financeiro.md como uma
-- das ~13 RPCs SECURITY DEFINER do CORE sem has_filial_access. Um
-- tesoureiro restrito à filial B que soubesse o id de um extrato/
-- transação da filial A conseguia confirmá-los (a UI filtrava; a RPC
-- não). GRANT EXECUTE TO authenticated + SECURITY DEFINER = fronteira
-- de segurança real, não só filtro de conveniência.
--
-- Esta migration faz EXATAMENTE estes pontos (nada mais):
--
-- 1) SELECT passa a incluir filial_id nos 2 loops (extratos / transações).
-- 2) has_filial_access(v_igreja, <filial do item>) em CADA item dos 2
--    loops — cobre 1:1, N:1 e 1:N; qualquer item fora do acesso do
--    chamador aborta com FIN_TENANT (antes do FIN_CONCILIADO, pra não
--    vazar "já conciliado" pra quem não tem acesso).
-- 3) Regra de filial mista alinhada ao motor F4
--    (fin_gerar_candidatos_conciliacao):
--      (e.filial_id = t.filial_id OR e.filial_id IS NULL OR t.filial_id IS NULL)
--    - ≤1 filial não-nula distinta entre todos os itens → ok
--      (v_filial_efetiva = essa filial, ou NULL se tudo for compartilhado)
--    - ≥2 filiais não-nulas distintas SÓ é permitido se pelo menos um
--      item tiver filial_id IS NULL (recurso compartilhado ancora o
--      split — caso real do motor F4 / conta bancária compartilhada);
--      v_filial_efetiva fica NULL
--    - ≥2 filiais não-nulas SEM nenhum item compartilhado → FIN_VALIDACAO
-- 4) conciliacoes_lote / conciliacoes_divisao passam a gravar
--    v_filial_efetiva (filial do recurso, não do contexto do chamador).
--    reconciliacao_audit_logs / conciliacao_ml_feedback MANTÊM a filial
--    do contexto do chamador (v_ctx): são tabelas de auditoria/relatório
--    (RelatorioCobertura.tsx filtra por filial do ator), não de controle
--    de acesso — trocar pra v_filial_efetiva fazia sumir do relatório
--    filtrado por Filial X um evento de conciliação de recurso
--    compartilhado feito DENTRO de X.
-- 5) Bypass pré-existente em 1:N: conciliacoes_divisao_transacoes era
--    montada a partir de p_vinculo->'divisoes' (campo separado de
--    transacao_ids). Um chamador podia passar transacao_ids legítimos
--    (passam no lock/tenant/HFA) e divisoes com um VICTIM de outro
--    tenant/filial — VICTIM nunca era travado nem checado, mas ficava
--    vinculado. Agora exige igualdade de conjuntos entre
--    transacao_ids e divisoes[].transacao_id.
-- 6) ORDER BY id nos 2 loops FOR UPDATE (guardrail D.1) — a função já
--    travava N linhas sem ordem determinística; duas chamadas
--    concorrentes com os mesmos ids em ordem invertida podiam deadlock.
--
-- NÃO muda: v_data_extrato (COALESCE do 1º), v_conta, bloco de
-- cardinalidade v_tipo_match, loop de status/irmã de transferência,
-- fin_registrar_auditoria. Assinatura (jsonb, jsonb DEFAULT NULL)
-- inalterada — ACL (GRANT authenticated/service_role, REVOKE anon) da
-- migration 20260711140000 permanece via CREATE OR REPLACE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fin_confirmar_conciliacao(
  p_vinculo jsonb,
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
  v_extrato_ids uuid[];
  v_transacao_ids uuid[];
  v_tipo_match text;
  v_score numeric := NULLIF(p_vinculo ->> 'score', '')::numeric;
  v_sugestao_id uuid := NULLIF(p_vinculo ->> 'sugestao_id', '')::uuid;
  v_ext record;
  v_trx record;
  v_conta uuid;
  v_data_extrato date;
  v_novo_status text;
  v_lote_id uuid;
  v_divisao_id uuid;
  v_soma_divisao numeric;
  v_id uuid;
  v_warnings text[] := '{}';
  v_filial_efetiva uuid;
  v_tem_filial_compartilhada boolean := false;
  v_filiais_distintas uuid[] := '{}';
  v_div_ids uuid[];
BEGIN
  v_extrato_ids := ARRAY(SELECT jsonb_array_elements_text(p_vinculo -> 'extrato_ids'))::uuid[];
  v_transacao_ids := ARRAY(SELECT jsonb_array_elements_text(p_vinculo -> 'transacao_ids'))::uuid[];

  IF array_length(v_extrato_ids, 1) IS NULL OR array_length(v_transacao_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato_ids e transacao_ids são obrigatórios';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  -- Trava e valida os extratos no tenant (mesma conta para todos).
  -- ORDER BY id: guardrail D.1 (ordem determinística anti-deadlock).
  FOR v_ext IN
    SELECT id, conta_id, valor, data_transacao, reconciliado, igreja_id, filial_id
      FROM public.extratos_bancarios
     WHERE id = ANY(v_extrato_ids)
     ORDER BY id
     FOR UPDATE
  LOOP
    IF v_ext.igreja_id IS DISTINCT FROM v_igreja THEN
      RAISE EXCEPTION 'FIN_TENANT: extrato % fora do tenant', v_ext.id;
    END IF;
    IF NOT public.has_filial_access(v_igreja, v_ext.filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do extrato %', v_ext.id;
    END IF;
    IF v_ext.filial_id IS NULL THEN
      v_tem_filial_compartilhada := true;
    ELSIF NOT (v_ext.filial_id = ANY(v_filiais_distintas)) THEN
      v_filiais_distintas := v_filiais_distintas || v_ext.filial_id;
    END IF;
    IF v_ext.reconciliado THEN
      RAISE EXCEPTION 'FIN_CONCILIADO: extrato % já está conciliado', v_ext.id;
    END IF;
    v_conta := COALESCE(v_conta, v_ext.conta_id);
    v_data_extrato := COALESCE(v_data_extrato, v_ext.data_transacao);
  END LOOP;
  IF v_conta IS NULL THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: nenhum extrato encontrado';
  END IF;

  -- Trava e valida as transações no tenant.
  PERFORM 1;
  FOR v_trx IN
    SELECT id, igreja_id, status, conciliacao_status, transferencia_id, filial_id
      FROM public.transacoes_financeiras
     WHERE id = ANY(v_transacao_ids)
     ORDER BY id
     FOR UPDATE
  LOOP
    IF v_trx.igreja_id IS DISTINCT FROM v_igreja THEN
      RAISE EXCEPTION 'FIN_TENANT: transação % fora do tenant', v_trx.id;
    END IF;
    IF NOT public.has_filial_access(v_igreja, v_trx.filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da transação %', v_trx.id;
    END IF;
    IF v_trx.filial_id IS NULL THEN
      v_tem_filial_compartilhada := true;
    ELSIF NOT (v_trx.filial_id = ANY(v_filiais_distintas)) THEN
      v_filiais_distintas := v_filiais_distintas || v_trx.filial_id;
    END IF;
    IF v_trx.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
      RAISE EXCEPTION 'FIN_CONCILIADO: transação % já está conciliada', v_trx.id;
    END IF;
  END LOOP;

  -- Filial mista: rejeita só quando ≥2 filiais concretas sem âncora
  -- compartilhada (filial_id IS NULL). Espelha o join do motor F4.
  IF coalesce(array_length(v_filiais_distintas, 1), 0) > 1
     AND NOT v_tem_filial_compartilhada THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: itens de filiais diferentes não podem ser conciliados juntos';
  END IF;
  IF coalesce(array_length(v_filiais_distintas, 1), 0) = 1 THEN
    v_filial_efetiva := v_filiais_distintas[1];
  ELSE
    -- tudo compartilhado, ou mix mediado por recurso compartilhado
    v_filial_efetiva := NULL;
  END IF;

  -- Determina o formato pelo cardinalidade.
  IF array_length(v_extrato_ids, 1) = 1 AND array_length(v_transacao_ids, 1) = 1 THEN
    v_tipo_match := '1:1';
  ELSIF array_length(v_transacao_ids, 1) = 1 THEN
    v_tipo_match := 'N:1';   -- vários extratos, uma transação (lote)
  ELSIF array_length(v_extrato_ids, 1) = 1 THEN
    v_tipo_match := '1:N';   -- um extrato, várias transações (divisão)
  ELSE
    RAISE EXCEPTION 'FIN_VALIDACAO: N extratos × N transações não é suportado';
  END IF;

  -- ── Estruturas de vínculo por formato ──
  IF v_tipo_match = '1:1' THEN
    UPDATE public.extratos_bancarios
       SET reconciliado = true, transacao_vinculada_id = v_transacao_ids[1]
     WHERE id = v_extrato_ids[1];

  ELSIF v_tipo_match = 'N:1' THEN
    DECLARE
      v_valor_trx numeric := COALESCE((SELECT valor FROM public.transacoes_financeiras WHERE id = v_transacao_ids[1]), 0);
      v_soma_ext numeric := COALESCE((SELECT SUM(valor) FROM public.extratos_bancarios WHERE id = ANY(v_extrato_ids)), 0);
    BEGIN
      -- diferenca é GENERATED ALWAYS (valor_transacao - valor_extratos): não inserir.
      INSERT INTO public.conciliacoes_lote
        (transacao_id, igreja_id, filial_id, conta_id, valor_transacao, valor_extratos, status, created_by)
      VALUES (v_transacao_ids[1], v_igreja, v_filial_efetiva, v_conta,
              v_valor_trx, v_soma_ext,
              -- preserva a distinção do fluxo antigo: balanceado × discrepância
              CASE WHEN abs(v_soma_ext - v_valor_trx) < 0.01 THEN 'conciliada' ELSE 'discrepancia' END,
              (v_ctx ->> 'ator_user_id')::uuid)
      RETURNING id INTO v_lote_id;

      IF abs(v_soma_ext - v_valor_trx) >= 0.01 THEN
        v_warnings := v_warnings ||
          format('lote com discrepância de %s (extratos %s × transação %s)',
                 to_char(abs(v_soma_ext - v_valor_trx), 'FM999G999G990D00'), v_soma_ext, v_valor_trx);
      END IF;
    END;

    INSERT INTO public.conciliacoes_lote_extratos (conciliacao_lote_id, extrato_id)
    SELECT v_lote_id, unnest(v_extrato_ids);

    UPDATE public.extratos_bancarios
       SET reconciliado = true
     WHERE id = ANY(v_extrato_ids);

  ELSE  -- 1:N (divisão)
    IF NOT (p_vinculo ? 'divisoes') THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: formato 1:N exige divisoes[{transacao_id, valor}]';
    END IF;

    -- Fecha bypass: divisoes e transacao_ids devem ser o MESMO conjunto.
    -- Sem isso, um VICTIM em divisoes (fora do array travado/checado)
    -- entrava em conciliacoes_divisao_transacoes sem HFA/tenant/lock.
    v_div_ids := ARRAY(
      SELECT DISTINCT (d ->> 'transacao_id')::uuid
        FROM jsonb_array_elements(p_vinculo -> 'divisoes') d
       WHERE NULLIF(d ->> 'transacao_id', '') IS NOT NULL
    );
    IF array_length(v_div_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: divisoes vazias ou sem transacao_id';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(v_div_ids) d_id
       WHERE NOT (d_id = ANY(v_transacao_ids))
    ) THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: divisoes.transacao_id fora de transacao_ids';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(v_transacao_ids) t_id
       WHERE NOT (t_id = ANY(v_div_ids))
    ) THEN
      RAISE EXCEPTION 'FIN_VALIDACAO: transacao_ids sem correspondente em divisoes';
    END IF;

    SELECT COALESCE(SUM((d ->> 'valor')::numeric), 0)
      INTO v_soma_divisao
      FROM jsonb_array_elements(p_vinculo -> 'divisoes') d;

    INSERT INTO public.conciliacoes_divisao
      (extrato_id, igreja_id, filial_id, conta_id, valor_extrato, status, created_by)
    VALUES (v_extrato_ids[1], v_igreja, v_filial_efetiva, v_conta,
            (SELECT valor FROM public.extratos_bancarios WHERE id = v_extrato_ids[1]),
            'confirmada', (v_ctx ->> 'ator_user_id')::uuid)
    RETURNING id INTO v_divisao_id;

    INSERT INTO public.conciliacoes_divisao_transacoes (conciliacao_divisao_id, transacao_id, valor)
    SELECT v_divisao_id, (d ->> 'transacao_id')::uuid, (d ->> 'valor')::numeric
      FROM jsonb_array_elements(p_vinculo -> 'divisoes') d;

    UPDATE public.extratos_bancarios
       SET reconciliado = true
     WHERE id = v_extrato_ids[1];
  END IF;

  -- ── Estado das transações: conciliado + baixa (pendente→pago) + irmã ──
  FOR v_trx IN
    SELECT id, status, transferencia_id
      FROM public.transacoes_financeiras
     WHERE id = ANY(v_transacao_ids)
  LOOP
    v_novo_status := CASE WHEN v_trx.status = 'pendente' THEN 'pago' ELSE v_trx.status END;

    UPDATE public.transacoes_financeiras
       SET conciliacao_status = 'conciliado_extrato',
           status = v_novo_status,
           data_pagamento = CASE WHEN v_trx.status = 'pendente' THEN v_data_extrato ELSE data_pagamento END,
           updated_at = now()
     WHERE id = v_trx.id;

    -- Perna irmã da transferência acompanha.
    IF v_trx.transferencia_id IS NOT NULL THEN
      UPDATE public.transacoes_financeiras
         SET conciliacao_status = 'conciliado_extrato',
             status = v_novo_status,
             data_pagamento = CASE WHEN status = 'pendente' THEN v_data_extrato ELSE data_pagamento END,
             updated_at = now()
       WHERE transferencia_id = v_trx.transferencia_id
         AND id <> v_trx.id;
    END IF;
  END LOOP;

  -- ── Auditoria (reconciliacao_audit_logs por par + ML feedback + fin_audit) ──
  -- tipo_reconciliacao restrito ao CHECK (automatica|manual|lote|desconciliacao);
  -- o formato fino (1:1/N:1/1:N) vai em metadata.tipo_match.
  -- filial_id = contexto do ATOR (não v_filial_efetiva): relatório de
  -- cobertura filtra pela filial em que o usuário estava trabalhando.
  INSERT INTO public.reconciliacao_audit_logs
    (extrato_id, transacao_id, conta_id, igreja_id, filial_id, acao,
     tipo_reconciliacao, score, valor_extrato, valor_transacao, diferenca,
     conciliacao_lote_id, usuario_id, metadata)
  SELECT e_id, t_id, v_conta, v_igreja, NULLIF(v_ctx ->> 'filial_id','')::uuid,
         'conciliacao',
         CASE WHEN v_tipo_match = 'N:1' THEN 'lote' ELSE 'manual' END,
         v_score,
         (SELECT valor FROM public.extratos_bancarios WHERE id = e_id),
         (SELECT valor FROM public.transacoes_financeiras WHERE id = t_id),
         NULL, v_lote_id, NULLIF(v_ctx ->> 'ator_profile_id','')::uuid,
         jsonb_build_object('tipo_match', v_tipo_match, 'canal', v_ctx ->> 'canal')
    FROM unnest(v_extrato_ids) e_id
    CROSS JOIN unnest(v_transacao_ids) t_id;

  IF NULLIF(v_ctx ->> 'ator_profile_id','') IS NOT NULL THEN
    INSERT INTO public.conciliacao_ml_feedback
      (igreja_id, filial_id, conta_id, tipo_match, extrato_ids, transacao_ids,
       acao, score, modelo_versao, usuario_id, sugestao_id, ajustes)
    VALUES (v_igreja, NULLIF(v_ctx ->> 'filial_id','')::uuid, v_conta, v_tipo_match,
            v_extrato_ids, v_transacao_ids, 'ajustada', COALESCE(v_score, 1.0), 'v1',
            (v_ctx ->> 'ator_profile_id')::uuid, v_sugestao_id,
            jsonb_build_object('via', 'fin_confirmar_conciliacao'));
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_confirmar_conciliacao', 'extratos_bancarios', v_extrato_ids[1],
    p_vinculo,
    jsonb_build_object('tipo_match', v_tipo_match,
                       'extrato_ids', to_jsonb(v_extrato_ids),
                       'transacao_ids', to_jsonb(v_transacao_ids)));

  RETURN jsonb_build_object('ok', true, 'tipo_match', v_tipo_match,
                            'extrato_ids', to_jsonb(v_extrato_ids),
                            'transacao_ids', to_jsonb(v_transacao_ids),
                            'warnings', to_jsonb(v_warnings));
END;
$$;

COMMENT ON FUNCTION public.fin_confirmar_conciliacao(jsonb, jsonb) IS
  'Porta única de confirmação de conciliação (1:1/N:1/1:N). '
  'has_filial_access por item; filial mista só com âncora compartilhada '
  '(alinhado ao motor F4); divisoes ≡ transacao_ids; locks ORDER BY id; '
  'lote/divisão usam v_filial_efetiva; audit/ML usam filial do contexto.';

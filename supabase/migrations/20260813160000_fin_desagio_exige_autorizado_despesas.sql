-- Codex #102 P1 (ainda aberto depois de 20260813150000):
-- fin_reverter_desagio_antecipacao já passava autorizado_lancar_despesas
-- pra fin_resolver_contexto, mas esse 2º argumento SÓ vale no canal bot
-- (ADR-029 convenção 4). No JWT, tesoureiro sem o flag ainda revertia.
-- E fin_alterar_status_lancamento (menu TransacaoActionsMenu / rpc
-- direto) continuava com p_flag NULL — bypass da porta dedicada.
--
-- Helper interno: resolver com o flag (bot) + checar o flag no JWT
-- (admin/super_admin têm bypass de papel; tesoureiro precisa do flag).
-- Usado por fin_reverter_desagio_antecipacao e, na reversão de deságio
-- pago, por fin_alterar_status_lancamento.

CREATE OR REPLACE FUNCTION public._fin_exigir_autorizado_lancar_despesas(p_contexto jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_uid uuid := auth.uid();
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, 'autorizado_lancar_despesas');

  -- Canal JWT: fin_resolver_contexto ignora p_flag_bot. Sem este check,
  -- tesoureiro web sem autorizado_lancar_despesas reverte a saída paga
  -- (Codex: "member who has filial access but lacks the flag").
  -- has_role('admin') cobre admin_igreja/admin_filial.
  IF v_uid IS NOT NULL
     AND NOT has_role(v_uid, 'admin'::app_role)
     AND NOT has_role(v_uid, 'super_admin'::app_role) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = v_uid
         AND COALESCE(p.autorizado_lancar_despesas, false)
    ) THEN
      RAISE EXCEPTION 'FIN_SEM_PERMISSAO: requer autorizado_lancar_despesas para reverter deságio de antecipação Getnet';
    END IF;
  END IF;

  RETURN v_ctx;
END;
$$;

COMMENT ON FUNCTION public._fin_exigir_autorizado_lancar_despesas(jsonb) IS
  'Uso interno: fin_resolver_contexto(autorizado_lancar_despesas) + check do flag no canal JWT (admin/super_admin bypass). Não GRANT pra authenticated — só RPCs SECURITY DEFINER irmãs chamam.';

REVOKE ALL ON FUNCTION public._fin_exigir_autorizado_lancar_despesas(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._fin_exigir_autorizado_lancar_despesas(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.fin_reverter_desagio_antecipacao(
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
  v_extrato_filial uuid;
  v_trx public.transacoes_financeiras%ROWTYPE;
  v_res jsonb;
BEGIN
  IF p_lote_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_lote_id é obrigatório';
  END IF;

  -- Bot: flag via fin_resolver_contexto. JWT: o resolver ignora o flag
  -- — _fin_exigir_autorizado_lancar_despesas cobre os dois canais
  -- (Codex #102 P1).
  v_ctx := public._fin_exigir_autorizado_lancar_despesas(p_contexto);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  -- Sem FOR UPDATE no lote: fin_alterar_status_lancamento trava a
  -- transação e o trigger AFTER UPDATE trava o lote. Travar lote ANTES
  -- da transação inverteria a ordem do caminho do menu (transação →
  -- lote) e abriria deadlock entre as duas superfícies.
  SELECT * INTO v_lote
    FROM public.getnet_antecipacao_lotes
   WHERE id = p_lote_id AND igreja_id = v_igreja;
  IF v_lote.id IS NULL THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lote % fora do tenant ou inexistente', p_lote_id;
  END IF;

  IF NOT public.has_filial_access(v_igreja, v_lote.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste lote';
  END IF;

  IF v_lote.status IS DISTINCT FROM 'lancamento_criado'
     OR v_lote.lancamento_desagio_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: lote % não tem deságio lançado para reverter', p_lote_id;
  END IF;

  -- Filial efetiva = extrato vinculado (lote global + extrato de filial
  -- B não é mais "de qualquer filial", §9.78).
  IF v_lote.extrato_bancario_id IS NOT NULL THEN
    SELECT filial_id INTO v_extrato_filial
      FROM public.extratos_bancarios
     WHERE id = v_lote.extrato_bancario_id
       AND igreja_id = v_igreja;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'FIN_FK: extrato vinculado ao lote % não encontrado', p_lote_id;
    END IF;
    IF NOT public.has_filial_access(v_igreja, v_extrato_filial) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial efetiva deste lote';
    END IF;
  END IF;

  SELECT * INTO v_trx
    FROM public.transacoes_financeiras
   WHERE id = v_lote.lancamento_desagio_id
     AND igreja_id = v_igreja;
  IF v_trx.id IS NULL THEN
    RAISE EXCEPTION 'FIN_FK: lançamento de deságio % inexistente ou fora do tenant', v_lote.lancamento_desagio_id;
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_trx.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial do lançamento de deságio';
  END IF;
  IF v_trx.origem_registro IS DISTINCT FROM 'getnet_antecipacao_desagio' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: lançamento % não é deságio de antecipação Getnet', v_trx.id;
  END IF;

  -- Porta única de status (ADR-029). v_ctx já resolvido, nunca NULL.
  -- Trigger sincronizar_lote_antecipacao_ao_reverter_desagio (pago →
  -- não-pago) volta o lote pra 'vinculado' e limpa lancamento_desagio_id.
  v_res := public.fin_alterar_status_lancamento(
    v_lote.lancamento_desagio_id,
    'pendente',
    '{}'::jsonb,
    v_ctx
  );

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_reverter_desagio_antecipacao', 'getnet_antecipacao_lotes', p_lote_id,
    jsonb_build_object('lancamento_desagio_id', v_lote.lancamento_desagio_id),
    v_res);

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_lote_id,
    'lancamento_id', v_lote.lancamento_desagio_id,
    'warnings', COALESCE(v_res -> 'warnings', '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.fin_reverter_desagio_antecipacao(uuid, jsonb) IS
  'Reverte a saída de deságio de um lote Getnet em lancamento_criado. Exige autorizado_lancar_despesas no bot E no JWT (tesoureiro sem o flag é recusado; admin/super_admin bypass). Helper _fin_exigir_autorizado_lancar_despesas. Valida has_filial_access no lote, na filial efetiva do extrato e na transação. Aninha fin_alterar_status_lancamento(..., v_ctx) — o trigger sincronizar_lote_antecipacao_ao_reverter_desagio volta o lote pra vinculado. Não trava o lote antes da transação (ordem igual ao menu, evita deadlock).';

GRANT EXECUTE ON FUNCTION public.fin_reverter_desagio_antecipacao(uuid, jsonb)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_reverter_desagio_antecipacao(uuid, jsonb)
  FROM anon;

CREATE OR REPLACE FUNCTION public.fin_alterar_status_lancamento(
  p_id uuid,
  p_novo_status text,
  p_dados jsonb DEFAULT '{}'::jsonb,
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
  v_atual public.transacoes_financeiras%ROWTYPE;
  v_warnings text[] := '{}';
BEGIN
  IF p_novo_status NOT IN ('pendente','pago','cancelado') THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: status deve ser pendente|pago|cancelado';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_atual FROM public.transacoes_financeiras
   WHERE id = p_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lançamento % fora do tenant ou inexistente', p_id;
  END IF;

  IF NOT public.has_filial_access(v_igreja, v_atual.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste lançamento';
  END IF;

  IF v_atual.conciliacao_status IN ('conciliado_extrato','conciliado_bot') THEN
    RAISE EXCEPTION 'FIN_CONCILIADO: status de lançamento conciliado não pode mudar (D4); desconcilie antes';
  END IF;

  IF v_atual.status = p_novo_status THEN
    v_warnings := v_warnings || 'status já era o solicitado; nenhuma mudança'::text;
    RETURN jsonb_build_object('ok', true, 'id', p_id, 'warnings', to_jsonb(v_warnings));
  END IF;

  -- Codex #102 P1: reverter deságio pago via esta porta genérica (menu
  -- TransacaoActionsMenu / rpc direto) não exigia autorizado_lancar_
  -- despesas, enquanto fin_lancar_desagio_antecipacao exige. Fecha o
  -- bypass. Helper também cobre o canal JWT (o 2º arg de
  -- fin_resolver_contexto só vale no bot, ADR-029).
  IF v_atual.origem_registro IS NOT DISTINCT FROM 'getnet_antecipacao_desagio'
     AND v_atual.status = 'pago'
     AND p_novo_status IS DISTINCT FROM 'pago' THEN
    v_ctx := public._fin_exigir_autorizado_lancar_despesas(p_contexto);
  END IF;

  IF p_novo_status = 'pendente' THEN
    -- Paridade com ActionsMenu: voltar a pendente limpa dados de pagamento.
    UPDATE public.transacoes_financeiras SET
      status = 'pendente', data_pagamento = NULL,
      juros = 0, multas = 0, desconto = 0, taxas_administrativas = 0,
      updated_at = now()
    WHERE id = p_id;
  ELSIF p_novo_status = 'pago' THEN
    -- Taxa administrativa reduz o que se RECEBE (entrada) e aumenta o que
    -- se PAGA (saída) — tipo vem da própria linha (bare column no SET).
    UPDATE public.transacoes_financeiras SET
      status = 'pago',
      data_pagamento = COALESCE((p_dados ->> 'data_pagamento')::date, CURRENT_DATE),
      juros  = COALESCE((p_dados ->> 'juros')::numeric, juros, 0),
      multas = COALESCE((p_dados ->> 'multas')::numeric, multas, 0),
      desconto = COALESCE((p_dados ->> 'desconto')::numeric, desconto, 0),
      taxas_administrativas = COALESCE((p_dados ->> 'taxas_administrativas')::numeric, taxas_administrativas, 0),
      valor_liquido = valor
        + COALESCE((p_dados ->> 'juros')::numeric, juros, 0)
        + COALESCE((p_dados ->> 'multas')::numeric, multas, 0)
        + (CASE WHEN tipo = 'saida' THEN 1 ELSE -1 END)
          * COALESCE((p_dados ->> 'taxas_administrativas')::numeric, taxas_administrativas, 0)
        - COALESCE((p_dados ->> 'desconto')::numeric, desconto, 0),
      updated_at = now()
    WHERE id = p_id;
  ELSE
    UPDATE public.transacoes_financeiras SET
      status = 'cancelado', updated_at = now()
    WHERE id = p_id;
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_alterar_status_lancamento', 'transacoes_financeiras', p_id,
    jsonb_build_object('de', v_atual.status, 'para', p_novo_status, 'dados', p_dados),
    NULL);

  RETURN jsonb_build_object('ok', true, 'id', p_id, 'warnings', to_jsonb(v_warnings));
END;
$$;

COMMENT ON FUNCTION public.fin_alterar_status_lancamento(uuid, text, jsonb, jsonb) IS
  'Altera status pendente/pago/cancelado. has_filial_access (§9.83). Reverter getnet_antecipacao_desagio pago exige autorizado_lancar_despesas (bot + JWT tesoureiro) — Codex #102 P1, fecha bypass do menu.';

GRANT EXECUTE ON FUNCTION public.fin_alterar_status_lancamento(uuid, text, jsonb, jsonb)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_alterar_status_lancamento(uuid, text, jsonb, jsonb)
  FROM anon;

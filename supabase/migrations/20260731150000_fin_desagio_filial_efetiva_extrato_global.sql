-- ============================================================================
-- Fix real (Codex, PR #67, 10ª rodada de review) sobre fin_lancar_desagio_
-- antecipacao (última versão: 20260731120000).
--
-- has_filial_access(_igreja_id, _filial_id) retorna true quando _filial_id
-- é NULL (registro global é compartilhado entre filiais — mesma convenção
-- de sempre). O guard de segurança da RPC checava
-- has_filial_access(v_igreja, v_extrato.filial_id): quando o EXTRATO
-- vinculado ao lote é global (filial_id NULL — caso real, extrato de conta
-- compartilhada), a checagem passava pra QUALQUER usuário do tenant,
-- inclusive um tesoureiro restrito a uma filial. E como o check de
-- compatibilidade logo abaixo só roda quando `v_extrato.filial_id IS NOT
-- NULL`, ele também era pulado inteiro nesse caso — nada validava que a
-- CONTA escolhida (p_conta_id) pertence a uma filial que o chamador
-- realmente acessa. Um tesoureiro da filial A que soubesse o UUID de uma
-- conta da filial B conseguia lançar o deságio nela diretamente via RPC
-- (SECURITY DEFINER bypassa RLS), desde que o lote estivesse vinculado a
-- um extrato global.
--
-- Fix: mover a leitura de v_conta_filial pra ANTES do guard de acesso e
-- checar has_filial_access contra a filial EFETIVA (a do extrato quando
-- ele tem uma; senão a da própria conta escolhida) — cobre o caso comum
-- (extrato com filial: comportamento idêntico a antes) e fecha o gap
-- (extrato global: agora valida que o chamador acessa a filial da conta).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fin_lancar_desagio_antecipacao(
  p_lote_id uuid,
  p_categoria_id uuid,
  p_conta_id uuid,
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
  v_categoria record;
  v_conta_filial uuid;
  v_filial_lancamento uuid;
  v_desagio numeric;
  v_res jsonb;
  v_lancamento_id uuid;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, 'autorizado_lancar_despesas');
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_lote FROM public.getnet_antecipacao_lotes
   WHERE id = p_lote_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF v_lote.id IS NULL THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: lote % fora do tenant ou inexistente', p_lote_id;
  END IF;
  IF v_lote.lancamento_desagio_id IS NOT NULL THEN
    RAISE EXCEPTION 'FIN_JA_LANCADO: deságio já lançado pro lote % (lancamento_id=%)', p_lote_id, v_lote.lancamento_desagio_id;
  END IF;
  IF v_lote.status <> 'vinculado' OR v_lote.extrato_bancario_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: lote precisa estar vinculado a um extrato antes de lançar o deságio';
  END IF;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', p_categoria_id, v_igreja);

  SELECT id, valor, data_transacao, filial_id INTO v_extrato
    FROM public.extratos_bancarios WHERE id = v_lote.extrato_bancario_id;
  IF v_extrato.id IS NULL THEN
    RAISE EXCEPTION 'FIN_FK: extrato bancário vinculado ao lote não encontrado';
  END IF;

  SELECT filial_id INTO v_conta_filial FROM public.contas WHERE id = p_conta_id;

  -- Checa acesso contra a filial EFETIVA: a do extrato quando ele tem uma
  -- (comportamento original); quando o extrato é global (NULL — conta
  -- compartilhada), cai pra filial da CONTA escolhida, senão qualquer
  -- tesoureiro de qualquer filial passaria no guard sem a conta nunca ser
  -- checada (achado do /code-review — extrato global pulava os dois
  -- checks: o de acesso E o de compatibilidade abaixo).
  IF NOT public.has_filial_access(v_igreja, COALESCE(v_extrato.filial_id, v_conta_filial)) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste lote/extrato';
  END IF;

  -- Filial efetiva do fluxo é a do EXTRATO vinculado, não a do lote em si
  -- (que pode ser NULL pra lotes "globais" — fin_vincular_lote_antecipacao
  -- sozinho não tem como cruzar isso, porque nesse ponto só existe o
  -- extrato, ainda não a conta do deságio). Conta precisa concordar com
  -- essa filial quando ela existir; conta global (filial_id NULL) sempre
  -- aceita, mesma convenção já usada nos outros guards de filial.
  IF v_extrato.filial_id IS NOT NULL
     AND v_conta_filial IS NOT NULL
     AND v_conta_filial IS DISTINCT FROM v_extrato.filial_id THEN
    RAISE EXCEPTION 'FIN_TENANT: conta selecionada pertence a outra filial (extrato vinculado é da filial %)', v_extrato.filial_id;
  END IF;

  SELECT tipo INTO v_categoria FROM public.categorias_financeiras WHERE id = p_categoria_id;
  IF v_categoria.tipo <> 'saida' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: categoria informada não é de saída';
  END IF;

  v_desagio := COALESCE(v_lote.valor_atual_contrato, 0) - v_extrato.valor;
  IF v_desagio <= 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: deságio calculado (%) não é positivo — confira o vínculo com o extrato', v_desagio;
  END IF;

  -- Grava a filial real do dinheiro que se moveu: a do extrato bancário
  -- (fonte da verdade), com fallback pra filial da conta só se o extrato
  -- também for global — nunca mais o filial_id cru do lote.
  v_filial_lancamento := COALESCE(v_extrato.filial_id, v_conta_filial);

  v_res := public.fin_criar_lancamento(
    'saida',
    v_desagio,
    v_extrato.data_transacao,
    p_conta_id,
    format('Deságio de antecipação Getnet — Contrato %s', v_lote.contrato_registradora),
    p_categoria_id,
    jsonb_build_object(
      'status', 'pago',
      'data_pagamento', v_extrato.data_transacao,
      'data_competencia', v_extrato.data_transacao,
      'origem_registro', 'getnet_antecipacao_desagio',
      'filial_id', v_filial_lancamento
    ),
    v_ctx
  );
  v_lancamento_id := (v_res ->> 'id')::uuid;

  UPDATE public.getnet_antecipacao_lotes
     SET lancamento_desagio_id = v_lancamento_id,
         status = 'lancamento_criado',
         updated_at = now()
   WHERE id = p_lote_id;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_lancar_desagio_antecipacao', 'getnet_antecipacao_lotes', p_lote_id,
    jsonb_build_object('categoria_id', p_categoria_id, 'conta_id', p_conta_id),
    jsonb_build_object('lancamento_id', v_lancamento_id, 'desagio', v_desagio));

  RETURN jsonb_build_object('ok', true, 'id', p_lote_id,
                            'lancamento_id', v_lancamento_id,
                            'desagio', v_desagio,
                            'warnings', '[]'::jsonb);
END;
$$;

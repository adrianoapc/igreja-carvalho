-- ============================================================================
-- 1 achado do /code-review (PR #67, rodada de 02/08 01:34, commit revisado
-- 802cf1d), real:
--
-- fin_vincular_lote_antecipacao (20260731140000) valida acesso de filial só
-- contra o NOVO extrato (`COALESCE(v_lote.filial_id, v_extrato.filial_id)`,
-- onde v_extrato é o extrato sendo vinculado agora). Quando o lote é
-- GLOBAL (v_lote.filial_id NULL) e já está vinculado a um extrato da
-- filial A, um tesoureiro restrito à filial B — que enxerga o lote global
-- normalmente — podia REVINCULAR (trocar) esse lote pra um extrato da
-- filial B sem NUNCA ter acesso checado contra a filial A, cujo vínculo
-- estava sobrescrevendo. Isso muda o deságio calculado e efetivamente
-- "rouba" a posse do fluxo de reconciliação da filial A sem autorização
-- nenhuma sobre ela.
--
-- Fix: quando o lote já tem um vínculo (`v_lote.extrato_bancario_id IS NOT
-- NULL`) e está sendo trocado por um extrato DIFERENTE (correção, não
-- vínculo inicial), valida acesso também contra a filial EFETIVA do
-- vínculo ATUAL — mesma convenção de `COALESCE(v_lote.filial_id, ...)`,
-- desta vez usando o extrato JÁ vinculado.
-- ============================================================================

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

  SELECT id, igreja_id, filial_id, valor, data_transacao, tipo INTO v_extrato
    FROM public.extratos_bancarios WHERE id = p_extrato_bancario_id;
  IF v_extrato.id IS NULL OR v_extrato.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: extrato bancário inexistente ou fora do tenant';
  END IF;
  IF v_extrato.tipo <> 'credito' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato bancário selecionado não é um crédito';
  END IF;

  IF NOT public.has_filial_access(v_igreja, COALESCE(v_lote.filial_id, v_extrato.filial_id)) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste vínculo';
  END IF;

  -- §9.68: revincular (trocar um extrato JÁ vinculado por outro) exige
  -- acesso à filial do vínculo ATUAL também, não só do novo — senão um
  -- tesoureiro restrito à filial B, vendo um lote global já vinculado a um
  -- extrato da filial A, conseguia sobrescrever esse vínculo sem nunca ter
  -- acesso checado contra a filial A (achado do /code-review).
  IF v_lote.extrato_bancario_id IS NOT NULL
     AND v_lote.extrato_bancario_id IS DISTINCT FROM p_extrato_bancario_id THEN
    SELECT filial_id INTO v_extrato_atual_filial
      FROM public.extratos_bancarios WHERE id = v_lote.extrato_bancario_id;
    IF NOT public.has_filial_access(v_igreja, COALESCE(v_lote.filial_id, v_extrato_atual_filial)) THEN
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

-- ============================================================================
-- Follow-up da Fase 3 (Hop 1): fecha a direção contrária do double-booking
-- extrato × antecipação.
--
-- fin_vincular_venda_banco_getnet já exclui extratos em
-- getnet_antecipacao_lotes. Mas fin_vincular_lote_antecipacao (pré-existente)
-- nunca checava reconciliado nem getnet_recebivel_lancamentos.extrato_bancario_id
-- — dava pra pegar um crédito que o Hop 1 já usou e amarrar a um lote.
--
-- Fix: lock do extrato + rejeita se reconciliado OU se já há recebível Hop 1
-- apontando pra ele. Não marca reconciliado no vínculo do lote (comportamento
-- histórico intacto; Hop 1 continua excluindo via NOT EXISTS no lote).
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

  -- Lock do extrato (mesmo padrão Hop 1): checagens de ocupação depois do
  -- lock, em statement nova — snapshot fresco sob READ COMMITTED.
  SELECT id, igreja_id, filial_id, valor, data_transacao, tipo, reconciliado
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

  IF NOT public.has_filial_access(v_igreja, COALESCE(v_lote.filial_id, v_extrato.filial_id)) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste vínculo';
  END IF;

  -- §9.68: revincular (trocar um extrato JÁ vinculado por outro) exige
  -- acesso à filial do vínculo ATUAL também, não só do novo.
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

COMMENT ON FUNCTION public.fin_vincular_lote_antecipacao(uuid, uuid, jsonb) IS
  'Vincula lote de antecipação Getnet a crédito bancário. Recusa extrato já reconciliado ou já usado pelo Hop 1 (getnet_recebivel_lancamentos.extrato_bancario_id) — fecha double-booking bidirecional com fin_vincular_venda_banco_getnet. has_filial_access no vínculo novo e no atual (§9.68).';

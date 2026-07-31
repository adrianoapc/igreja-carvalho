-- ============================================================================
-- Fix: vínculo lote↔extrato não era concurrency-safe (achado do
-- /code-review sobre 20260731120000).
--
-- fin_vincular_lote_antecipacao trava a linha do LOTE (`FOR UPDATE WHERE
-- id = p_lote_id`) e faz um EXISTS pra checar se o extrato já está
-- vinculado a outro lote — mas esse EXISTS não trava nada no extrato, só
-- lê o estado committed até então. Duas chamadas concorrentes vinculando
-- LOTES DIFERENTES ao MESMO extrato (dois tesoureiros clicando quase
-- juntos, ou um retry duplicado) travam linhas de lote diferentes, então
-- nenhuma bloqueia a outra — os dois EXISTS rodam antes de qualquer UPDATE
-- comitar, os dois passam, os dois UPDATEs committam: o mesmo crédito
-- bancário vira antecipação de 2 lotes, e lançar os 2 deságios conta o
-- mesmo dinheiro duas vezes.
--
-- Fix: índice único parcial em extrato_bancario_id (parcial porque a
-- coluna é nullable — lotes ainda não vinculados ficam livres pra ter
-- quantos NULL quiser, só valores não-nulos precisam ser únicos). Isso é
-- garantido pelo Postgres a nível de linha, imune à janela de corrida que
-- o EXISTS sozinho não fecha. UPDATE final ganha um handler pra
-- unique_violation, convertendo o erro técnico do banco na mesma mensagem
-- amigável que o EXISTS já dava pro caso comum (sem corrida) — o EXISTS
-- continua ali como fast-path (evita ida ao banco pro caso óbvio), o
-- índice é quem garante de verdade.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS getnet_antecipacao_lotes_extrato_unique
  ON public.getnet_antecipacao_lotes (extrato_bancario_id)
  WHERE extrato_bancario_id IS NOT NULL;

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

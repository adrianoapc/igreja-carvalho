-- ============================================================================
-- Fix: lote de antecipação "global" (filial_id NULL) deixava passar deságio
-- inconsistente entre filiais (achado real, review Codex sobre o commit
-- anterior desta mesma PR).
--
-- 20260731100000 validou extrato/conta contra `getnet_antecipacao_lotes.
-- filial_id` — mas esse campo é nullable (integração pode gerar lote sem
-- filial fixa). Quando NULL, a validação inteira era pulada: um lote global
-- podia ser vinculado a um extrato da filial B (fin_vincular_lote_
-- antecipacao aceita, pois só rejeita quando o LOTE tem filial e diverge —
-- lote sem filial nunca diverge de nada) e depois ter o deságio lançado
-- numa conta da filial C — nada cruzava B com C, e o lançamento final ainda
-- gravava filial_id=NULL (a do lote), não a do dinheiro que de fato se
-- moveu.
--
-- Fix: fin_lancar_desagio_antecipacao passa a validar a conta contra a
-- filial do EXTRATO vinculado (não contra a do lote) — cobre os dois casos
-- (lote com filial: extrato já é garantidamente da mesma, por causa da
-- validação de 20260731100000; lote sem filial: extrato concreto que foi
-- de fato escolhido é quem ancora a filial real do fluxo). O lançamento de
-- saída também passa a gravar filial_id = extrato (fallback pra filial da
-- própria conta se o extrato também for global), em vez do filial_id cru
-- do lote.
--
-- Junto (achado do /code-review sobre este mesmo fix, mesma sessão):
-- `getnet_antecipacao_lotes.filial_id` nunca teve FK real — diferente de
-- `extratos_bancarios.filial_id`/`contas.filial_id`, que já têm `ON DELETE
-- SET NULL`. Deletar uma filial depois de um lote vinculado a um extrato
-- dela deixaria o extrato e as contas com filial_id=NULL (cascade), mas o
-- LOTE ficaria com um UUID solto (dangling) — divergência que o frontend
-- (`LancarDesagioDialog.tsx`) explorava ao cair de volta pro `lote.
-- filial_id` quando o do extrato vinha NULL, filtrando contas por um UUID
-- que não bate com NADA (dropdown vazio, ninguém consegue lançar o
-- deságio, mesmo o backend aceitando qualquer conta nesse caso). Fix duplo:
-- FK real no lote (raiz do problema) + frontend para de cair pro
-- `lote.filial_id` (só usa a filial do extrato, espelhando exatamente a
-- regra do backend).
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
    NULL
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

-- ─── FK real em getnet_antecipacao_lotes.filial_id ─────────────────────────
-- Mesmo padrão de extratos_bancarios.filial_id/contas.filial_id — sem isso
-- o lote pode ficar com um UUID de filial deletada, divergindo do que
-- extrato/conta (que já têm ON DELETE SET NULL) passam a ter.

ALTER TABLE public.getnet_antecipacao_lotes
  ADD CONSTRAINT getnet_antecipacao_lotes_filial_id_fkey
  FOREIGN KEY (filial_id) REFERENCES public.filiais(id) ON DELETE SET NULL;

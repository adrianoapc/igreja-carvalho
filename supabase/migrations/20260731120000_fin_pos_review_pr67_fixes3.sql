-- ============================================================================
-- Mais 3 achados reais do /code-review sobre os fixes anteriores desta
-- mesma PR (verificados por leitura direta do código antes de agir):
--
-- 1) atualizar_saldo_conta() não tratava edição de uma transação JÁ PAGA
--    (status continua 'pago' antes e depois — ex.: corrigir valor/desconto/
--    taxas_administrativas de um lançamento confirmado via TransacaoDialog).
--    O trigger só cobria as transições pendente↔pago; quando OLD.status =
--    NEW.status = 'pago', nenhum dos dois branches disparava, então
--    valor_liquido mudava na linha mas contas.saldo_atual continuava com o
--    valor antigo — o saldo real ficava desatualizado silenciosamente.
--
-- 2) fin_vincular_lote_antecipacao (e fin_lancar_desagio_antecipacao) são
--    SECURITY DEFINER e só verificavam igreja_id — nenhum dos dois checava
--    se o CHAMADOR tem acesso à filial do lote (ou do extrato, pra lote
--    global). Um tesoureiro restrito a uma filial que soubesse/adivinhasse
--    o UUID de um lote de outra filial conseguia vincular/lançar deságio
--    nele diretamente via RPC, ignorando a segmentação de filial da UI —
--    mesma classe de gap que fin_importar_recebivel_getnet já cobria.
--
-- 3) fin_lancar_desagio_antecipacao chama fin_criar_lancamento passando
--    NULL como p_contexto em vez do v_ctx já resolvido — se algum dia
--    chamado via service_role (bot/edge) com contexto explícito válido, a
--    chamada aninhada recalcula do zero e fin_resolver_contexto rejeita
--    (service role exige p_contexto não-nulo). Sem call-site service-role
--    hoje (só UI), mas incorreto e barato de corrigir.
-- ============================================================================

-- ─── 1. atualizar_saldo_conta cobre pago→pago (edição de valor/conta/tipo) ──

CREATE OR REPLACE FUNCTION public.atualizar_saldo_conta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pago' THEN
      IF NEW.tipo = 'entrada' THEN
        UPDATE public.contas
           SET saldo_atual = saldo_atual + COALESCE(NEW.valor_liquido, NEW.valor)
         WHERE id = NEW.conta_id;
      ELSIF NEW.tipo = 'saida' THEN
        UPDATE public.contas
           SET saldo_atual = saldo_atual - COALESCE(NEW.valor_liquido, NEW.valor)
         WHERE id = NEW.conta_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- TG_OP = 'UPDATE' (só dispara em UPDATE OF status — presente no SET de
  -- fin_atualizar_lancamento/fin_alterar_status_lancamento mesmo quando o
  -- valor do status em si não muda).
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    -- pendente/cancelado -> pago: aplica o movimento.
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(NEW.valor_liquido, NEW.valor)
       WHERE id = NEW.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(NEW.valor_liquido, NEW.valor)
       WHERE id = NEW.conta_id;
    END IF;
  ELSIF OLD.status = 'pago' AND NEW.status != 'pago' THEN
    -- pago -> pendente/cancelado: desfaz o movimento.
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    END IF;
  ELSIF OLD.status = 'pago' AND NEW.status = 'pago' THEN
    -- pago -> pago: desfaz o movimento antigo (conta/tipo/valor de antes) e
    -- aplica o novo — cobre edição de valor numa mesma conta E o caso mais
    -- raro de trocar conta_id/tipo mantendo status pago.
    IF OLD.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    ELSIF OLD.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    END IF;
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(NEW.valor_liquido, NEW.valor)
       WHERE id = NEW.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(NEW.valor_liquido, NEW.valor)
       WHERE id = NEW.conta_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ─── 2a. fin_vincular_lote_antecipacao exige acesso à filial ──────────────

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

  -- SECURITY DEFINER bypassa RLS — verifica explicitamente que o chamador
  -- tem acesso à filial envolvida (a do lote quando definida, senão a do
  -- extrato escolhido — mesmo raciocínio de filial efetiva do fix
  -- anterior). Sem isso, um tesoureiro restrito a uma filial que soubesse
  -- o UUID de um lote/extrato de outra conseguia vincular direto via RPC,
  -- ignorando a segmentação de filial da UI (achado do /code-review).
  IF NOT public.has_filial_access(v_igreja, COALESCE(v_lote.filial_id, v_extrato.filial_id)) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste vínculo';
  END IF;

  -- Lote com filial definida só pode vincular a extrato da mesma filial
  -- (filial NULL no lote = lote global, aceita qualquer extrato do tenant).
  IF v_lote.filial_id IS NOT NULL
     AND v_extrato.filial_id IS DISTINCT FROM v_lote.filial_id THEN
    RAISE EXCEPTION 'FIN_TENANT: extrato bancário pertence a outra filial (lote é da filial %)', v_lote.filial_id;
  END IF;

  -- Mesma linha de extrato não pode virar antecipação de dois lotes diferentes.
  IF EXISTS (
    SELECT 1 FROM public.getnet_antecipacao_lotes
     WHERE extrato_bancario_id = p_extrato_bancario_id AND id <> p_lote_id
  ) THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato bancário já vinculado a outro lote de antecipação';
  END IF;

  UPDATE public.getnet_antecipacao_lotes
     SET extrato_bancario_id = p_extrato_bancario_id,
         status = 'vinculado',
         updated_at = now()
   WHERE id = p_lote_id;

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

-- ─── 2b + 3. fin_lancar_desagio_antecipacao exige acesso à filial + repassa v_ctx ──

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

  -- Mesmo guard de fin_vincular_lote_antecipacao — SECURITY DEFINER
  -- bypassa RLS, verifica explicitamente acesso à filial efetiva
  -- (achado do /code-review).
  IF NOT public.has_filial_access(v_igreja, v_extrato.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial deste lote/extrato';
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

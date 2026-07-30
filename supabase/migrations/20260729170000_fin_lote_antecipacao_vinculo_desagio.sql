-- ============================================================================
-- Importação do Recebível Getnet — Fase B (ADR-029)
--
-- Completa o que a Fase A (20260729100000) deixou pendente: vínculo manual
-- de um lote de antecipação (getnet_antecipacao_lotes) com a linha real do
-- extrato bancário e lançamento do deságio como saída. SEM match/conciliação
-- automática — a escolha de qual linha do extrato corresponde ao lote é
-- manual, feita pelo tesoureiro (decisão do usuário registrada no plano).
--
-- Deságio NÃO é uma coluna persistida: é sempre `valor_atual_contrato -
-- extratos_bancarios.valor` da linha vinculada, recalculado em leitura (evita
-- duplicar o dado e ele ficar dessincronizado se algum dia o extrato for
-- corrigido antes do lançamento).
--
-- Renomeada de 20260729120000 pra 20260729170000: essa versão colidiu com
-- outra migration aplicada em paralelo no mesmo timestamp (fin_dre_regime_
-- eixo_data, branch feat/financeiro-tipo-data-filtro) — supabase db push
-- rastreia migration por número de versão, não por conteúdo/nome de
-- arquivo, então esta ficou marcada como "aplicada" sem o SQL ter rodado
-- (fin_vincular_lote_antecipacao/fin_lancar_desagio_antecipacao não
-- existiam no banco). Conteúdo idêntico ao original, só a versão mudou.
-- ============================================================================

-- ─── 1. fin_vincular_lote_antecipacao ───────────────────────────────────────
-- Grava extrato_bancario_id no lote e muda status pra 'vinculado'. Recusa se
-- o lote já tem lançamento de saída criado (mudar o vínculo invalidaria o
-- valor já lançado — desvincule não existe nesta fase, é preciso reabrir
-- decisão manual fora do sistema se acontecer). Idempotente pra re-vincular
-- antes de lançar (corrigir escolha errada).

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

  SELECT id, igreja_id, valor, data_transacao, tipo INTO v_extrato
    FROM public.extratos_bancarios WHERE id = p_extrato_bancario_id;
  IF v_extrato.id IS NULL OR v_extrato.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: extrato bancário inexistente ou fora do tenant';
  END IF;
  IF v_extrato.tipo <> 'credito' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: extrato bancário selecionado não é um crédito';
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
                            'extrato_valor', v_extrato.valor,
                            'extrato_data', v_extrato.data_transacao,
                            'warnings', '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.fin_vincular_lote_antecipacao(uuid, uuid, jsonb) IS
  'Vincula manualmente um lote de antecipação Getnet a uma linha de extrato bancário já importada; calcula o deságio (valor_atual_contrato - valor do extrato). Fase B (ADR-029). Recusa trocar vínculo depois do lançamento criado.';

-- ─── 2. fin_lancar_desagio_antecipacao ──────────────────────────────────────
-- Lança o deságio como saída via fin_criar_lancamento (porta única de
-- escrita, ADR-029) — status='pago' direto (o dinheiro já saiu na
-- antecipação), data = data do extrato vinculado. Recusa se já lançado
-- (idempotente por rejeição, não por no-op silencioso — evita duplicar saída
-- por clique duplo ou reimport).

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

  SELECT tipo INTO v_categoria FROM public.categorias_financeiras WHERE id = p_categoria_id;
  IF v_categoria.tipo <> 'saida' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: categoria informada não é de saída';
  END IF;

  SELECT id, valor, data_transacao INTO v_extrato
    FROM public.extratos_bancarios WHERE id = v_lote.extrato_bancario_id;
  IF v_extrato.id IS NULL THEN
    RAISE EXCEPTION 'FIN_FK: extrato bancário vinculado ao lote não encontrado';
  END IF;

  v_desagio := COALESCE(v_lote.valor_atual_contrato, 0) - v_extrato.valor;
  IF v_desagio <= 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: deságio calculado (%) não é positivo — confira o vínculo com o extrato', v_desagio;
  END IF;

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
      'filial_id', v_lote.filial_id
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
    jsonb_build_object('categoria_id', p_categoria_id, 'conta_id', p_conta_id, 'desagio', v_desagio),
    jsonb_build_object('lancamento_id', v_lancamento_id));

  RETURN jsonb_build_object('ok', true, 'id', p_lote_id,
                            'lancamento_id', v_lancamento_id,
                            'desagio', v_desagio,
                            'warnings', '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.fin_lancar_desagio_antecipacao(uuid, uuid, uuid, jsonb) IS
  'Lança o deságio de um lote de antecipação Getnet vinculado como saída (via fin_criar_lancamento). Fase B (ADR-029). Recusa se já lançado (evita duplicar).';

-- ─── 3. Grants ──────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.fin_vincular_lote_antecipacao(uuid, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fin_lancar_desagio_antecipacao(uuid, uuid, uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_vincular_lote_antecipacao(uuid, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.fin_lancar_desagio_antecipacao(uuid, uuid, uuid, jsonb) FROM anon;

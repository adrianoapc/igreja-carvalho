-- Achado do Cursor Agent (review automático) na PR #116, corrigido no mesmo
-- dia antes do merge — mas já tinha sido aplicado uma vez em produção via
-- 20260818200000 (supabase db push --include-all) com o corpo ERRADO, então
-- este fix foi aplicado direto via `supabase db query` assim que achado, e
-- esta migration só formaliza no histórico o que já está ao vivo.
--
-- 20260818200000 renomeou a migration nunca-aplicada 20260813150000 pra
-- resolver colisão de timestamp, e mesclou a fonte SFTP (Hop2) na função
-- fin_listar_ledger_conciliacao_cartao — mas não percebeu que a MESMA
-- migration também redefine fin_reverter_desagio_antecipacao, e que
-- 20260813160000 (aplicada, timestamp ANTERIOR mas cronologicamente depois
-- do conteúdo de 20260813150000 no PR #102) tinha corrigido essa função pra
-- chamar o helper _fin_exigir_autorizado_lancar_despesas em vez de
-- fin_resolver_contexto(..., 'autorizado_lancar_despesas') direto — porque
-- esse 2º argumento só vale no canal bot (ADR-029), deixando um tesoureiro
-- JWT sem o flag autorizado_lancar_despesas ir além da entrada da função
-- (lookup de lote, tenant, filial) antes de ser barrado só depois pela
-- checagem aninhada em fin_alterar_status_lancamento — degradação de
-- defesa em profundidade, não bypass total (a mutação final ainda era
-- bloqueada), mas real: 20260818200000 restaurou essa versão mais antiga
-- ao rodar por último.
--
-- Fix: mesma troca de linha que 20260813160000 já tinha feito — chamar
-- _fin_exigir_autorizado_lancar_despesas(p_contexto) em vez de
-- fin_resolver_contexto(p_contexto, 'autorizado_lancar_despesas'). Testado
-- num Postgres isolado (Docker) com usuário JWT sem a flag (rejeitado
-- imediatamente na entrada) e com a flag (reversão completa com sucesso)
-- antes de aplicar.

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
  -- (Codex #102 P1 / achado do Cursor Agent na PR #116).
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

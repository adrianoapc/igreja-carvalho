-- ============================================================================
-- Fix: contas.saldo_atual usava valor BRUTO (transacoes_financeiras.valor),
-- não o líquido (valor_liquido) — desde a criação do trigger em
-- 20251130045754, antes do conceito de valor_liquido existir (ADR-027,
-- jul/2026). Todo lançamento com taxa administrativa/desconto/juros/multa
-- fazia o saldo da conta divergir do saldo real do banco: uma entrada de
-- R$203,58 bruto com R$3,58 de taxa (líquido R$200,00) somava R$203,58 no
-- saldo, não os R$200,00 que efetivamente entraram na conta.
--
-- Dois pontos corrigidos, os únicos dois lugares que somam/subtraem valor
-- de contas.saldo_atual a partir de transacoes_financeiras (fin_criar_
-- transferencia e fin_ajustar_saldo usam p_valor direto — sem conceito de
-- bruto×líquido, fora de escopo):
--   1. atualizar_saldo_conta() — trigger executor único (AFTER UPDATE OF
--      status), dispara na transição pendente↔pago.
--   2. fin_recalcular_saldo_conta() — utilitário de correção de drift
--      histórico (existia desde a F1, nunca tinha sido chamado pela UI).
--
-- COALESCE(valor_liquido, valor) em vez de só valor_liquido: lançamentos
-- antigos (antes do ADR-027) ou qualquer INSERT que não passe por
-- fin_criar_lancamento podem ter valor_liquido NULL — cai pro bruto nesse
-- caso, mesmo comportamento de fallback já usado no frontend
-- (LancamentoCard, TransacoesPage) desde a §9.15/9.24.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.atualizar_saldo_conta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
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
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual - COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas
         SET saldo_atual = saldo_atual + COALESCE(OLD.valor_liquido, OLD.valor)
       WHERE id = OLD.conta_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fin_recalcular_saldo_conta(
  p_conta_id uuid,
  p_aplicar boolean DEFAULT false,
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
  v_conta public.contas%ROWTYPE;
  v_calculado numeric;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT * INTO v_conta FROM public.contas
   WHERE id = p_conta_id AND igreja_id = v_igreja
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIN_NAO_ENCONTRADO: conta % fora do tenant ou inexistente', p_conta_id;
  END IF;

  SELECT COALESCE(v_conta.saldo_inicial, 0)
       + COALESCE(SUM(
           CASE WHEN tipo = 'entrada' THEN COALESCE(valor_liquido, valor)
                ELSE -COALESCE(valor_liquido, valor) END
         ), 0)
    INTO v_calculado
    FROM public.transacoes_financeiras
   WHERE conta_id = p_conta_id AND status = 'pago';

  IF p_aplicar THEN
    UPDATE public.contas
       SET saldo_atual = v_calculado, updated_at = now()
     WHERE id = p_conta_id;
  END IF;

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_recalcular_saldo_conta', 'contas', p_conta_id,
    jsonb_build_object('aplicar', p_aplicar),
    jsonb_build_object('saldo_registrado', v_conta.saldo_atual,
                       'saldo_calculado', v_calculado));

  RETURN jsonb_build_object('ok', true, 'id', p_conta_id,
                            'saldo_registrado', v_conta.saldo_atual,
                            'saldo_calculado', v_calculado,
                            'aplicado', p_aplicar,
                            'warnings', '[]'::jsonb);
END;
$$;

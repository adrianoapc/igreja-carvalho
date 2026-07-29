-- ============================================================================
-- Fix: trigger_marcar_extrato_divisao (AFTER INSERT ON conciliacoes_divisao)
-- inseria em reconciliacao_audit_logs usando colunas que nunca existiram
-- (tipo_match, detalhes) e omitia tipo_reconciliacao (NOT NULL sem default).
--
-- reconciliacao_audit_logs só ganhou tipo_match como coluna em
-- conciliacao_ml_feedback (tabela distinta) — aqui o formato fino do match
-- sempre foi metadata jsonb (ver 20260223222843 e 20260711140000).
--
-- Efeito: toda conciliação 1:N (dividir 1 extrato em N transações) via
-- fin_confirmar_conciliacao insere em conciliacoes_divisao (F3,
-- 20260711140000:167), disparando este trigger e quebrando com:
--   column "tipo_match" of relation "reconciliacao_audit_logs" does not exist
-- ============================================================================

CREATE OR REPLACE FUNCTION public.marcar_extrato_divisao_reconciliado()
RETURNS TRIGGER AS $$
BEGIN
  -- Marcar o extrato como reconciliado
  UPDATE public.extratos_bancarios
  SET reconciliado = true
  WHERE id = NEW.extrato_id;

  -- Registrar no log de auditoria
  INSERT INTO public.reconciliacao_audit_logs (
    extrato_id,
    transacao_id,
    acao,
    tipo_reconciliacao,
    score,
    usuario_id,
    igreja_id,
    filial_id,
    metadata
  ) VALUES (
    NEW.extrato_id,
    NULL,
    'divisao_criada',
    'manual',
    100,
    NEW.created_by,
    NEW.igreja_id,
    NEW.filial_id,
    jsonb_build_object('divisao_id', NEW.id, 'valor_extrato', NEW.valor_extrato, 'tipo_match', '1:N')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

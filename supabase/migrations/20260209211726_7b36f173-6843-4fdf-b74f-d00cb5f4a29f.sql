-- Dropar versão antiga (4 params) antes de recriar com 5
DROP FUNCTION IF EXISTS public.open_sessao_contagem(UUID, UUID, DATE, TEXT);

-- Recriar com suporte a evento_id
CREATE OR REPLACE FUNCTION public.open_sessao_contagem(
  p_igreja_id UUID,
  p_filial_id UUID,
  p_data_culto DATE,
  p_periodo TEXT,
  p_evento_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sessao_id UUID;
  v_result JSON;
  v_config RECORD;
BEGIN
  SELECT * INTO v_config 
  FROM public.configuracoes_financeiro 
  WHERE igreja_id = p_igreja_id 
  LIMIT 1;

  IF v_config IS NULL THEN
    RAISE EXCEPTION 'Configuração financeira não encontrada para igreja_id=%', p_igreja_id;
  END IF;

  SELECT id INTO v_sessao_id
  FROM public.sessoes_contagem
  WHERE igreja_id = p_igreja_id
    AND data_culto = p_data_culto
    AND periodo = p_periodo
    AND (p_filial_id IS NULL OR filial_id = p_filial_id)
    AND status NOT IN ('cancelado', 'finalizado')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sessao_id IS NULL THEN
    INSERT INTO public.sessoes_contagem (
      igreja_id, filial_id, data_culto, periodo, status, evento_id,
      blind_count_mode, blind_min_counters, blind_tolerance_value,
      blind_compare_level, blind_lock_totals,
      provider_tipo, webhook_url, secret_hint, sync_strategy, created_by
    ) VALUES (
      p_igreja_id, p_filial_id, p_data_culto, p_periodo, 'aberto', p_evento_id,
      COALESCE(v_config.blind_count_mode, 'disabled'),
      COALESCE(v_config.blind_min_counters, 2),
      COALESCE(v_config.blind_tolerance_value, 0),
      COALESCE(v_config.blind_compare_level, 'total'),
      COALESCE(v_config.blind_lock_totals, false),
      v_config.provider_tipo, v_config.webhook_url, v_config.secret_hint,
      v_config.sync_strategy, auth.uid()
    )
    RETURNING id INTO v_sessao_id;
  ELSE
    IF p_evento_id IS NOT NULL THEN
      UPDATE public.sessoes_contagem
      SET evento_id = p_evento_id, updated_at = NOW()
      WHERE id = v_sessao_id;
    END IF;
  END IF;

  SELECT json_build_object(
    'id', id, 'igreja_id', igreja_id, 'filial_id', filial_id,
    'data_culto', data_culto, 'periodo', periodo, 'status', status,
    'evento_id', evento_id, 'data_fechamento', data_fechamento
  ) INTO v_result
  FROM public.sessoes_contagem
  WHERE id = v_sessao_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.open_sessao_contagem IS 'Abre ou retorna sessão de contagem existente, com suporte a vínculo com eventos do calendário';
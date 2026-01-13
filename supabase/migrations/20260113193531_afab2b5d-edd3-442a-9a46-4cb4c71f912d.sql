-- Garantir unicidade de sessão por igreja/data/período, com e sem filial
-- 1) Unicidade quando filial_id NÃO é nulo
CREATE UNIQUE INDEX IF NOT EXISTS sessoes_contagem_unique_filial
ON public.sessoes_contagem(igreja_id, filial_id, data_culto, periodo)
WHERE filial_id IS NOT NULL;

-- 2) Unicidade para sessões "globais" (filial_id nulo)
CREATE UNIQUE INDEX IF NOT EXISTS sessoes_contagem_unique_global
ON public.sessoes_contagem(igreja_id, data_culto, periodo)
WHERE filial_id IS NULL;

-- Atualizar função open_sessao_contagem para tratar corrida com unique_violation
CREATE OR REPLACE FUNCTION public.open_sessao_contagem(
  p_igreja_id uuid,
  p_filial_id uuid,
  p_data_culto date,
  p_periodo text
)
RETURNS public.sessoes_contagem
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg record;
  v_existing public.sessoes_contagem%rowtype;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null';
  END IF;

  -- Permissão: admin da mesma igreja
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role::text = 'admin' AND ur.igreja_id = p_igreja_id
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  -- Evitar duplicidade: sessão já aberta para mesmo dia/periodo (comparando filial com IS NOT DISTINCT FROM)
  SELECT * INTO v_existing
  FROM public.sessoes_contagem s
  WHERE s.igreja_id = p_igreja_id
    AND (s.filial_id IS NOT DISTINCT FROM p_filial_id)
    AND s.data_culto = p_data_culto
    AND s.periodo = p_periodo
    AND s.status <> 'cancelado'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Buscar configuração por prioridade: filial > igreja
  SELECT * INTO v_cfg
  FROM public.financeiro_config fc
  WHERE fc.igreja_id = p_igreja_id
    AND (fc.filial_id IS NOT DISTINCT FROM p_filial_id)
  ORDER BY fc.filial_id NULLS LAST
  LIMIT 1;

  -- Tentar inserir; em caso de corrida (unique_violation) retornar sessão existente
  BEGIN
    IF v_cfg IS NULL THEN
      INSERT INTO public.sessoes_contagem(
        igreja_id, filial_id, data_culto, periodo,
        status,
        blind_count_mode, blind_min_counters, blind_tolerance_value, blind_compare_level, blind_lock_totals,
        sync_strategy,
        created_by
      ) VALUES (
        p_igreja_id, p_filial_id, p_data_culto, p_periodo,
        'aberto',
        'optional', 2, 0, 'total', true,
        'webhook',
        v_uid
      ) RETURNING * INTO v_existing;
    ELSE
      INSERT INTO public.sessoes_contagem(
        igreja_id, filial_id, data_culto, periodo,
        status,
        blind_count_mode, blind_min_counters, blind_tolerance_value, blind_compare_level, blind_lock_totals,
        sync_strategy,
        created_by
      ) VALUES (
        p_igreja_id, p_filial_id, p_data_culto, p_periodo,
        'aberto',
        v_cfg.blind_count_mode, v_cfg.blind_min_counters, v_cfg.blind_tolerance_value, v_cfg.blind_compare_level, v_cfg.blind_lock_totals,
        v_cfg.sync_strategy,
        v_uid
      ) RETURNING * INTO v_existing;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    -- Outra transação abriu a sessão; retornar a existente
    SELECT * INTO v_existing
    FROM public.sessoes_contagem s
    WHERE s.igreja_id = p_igreja_id
      AND (s.filial_id IS NOT DISTINCT FROM p_filial_id)
      AND s.data_culto = p_data_culto
      AND s.periodo = p_periodo
      AND s.status <> 'cancelado'
    ORDER BY s.created_at DESC
    LIMIT 1;
  END;

  RETURN v_existing;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_sessao_contagem(uuid, uuid, date, text) TO authenticated;
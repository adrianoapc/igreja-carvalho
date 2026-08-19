-- Últimos 4 achados da auditoria das ~161 funções não-fin_* (mesma
-- investigação das PRs #119-#123): authenticated tem uso legítimo real
-- nessas RPCs, mas o corpo não valida QUEM está chamando nem que
-- tenant/filial o parâmetro pedido pertence ao chamador. Diferente das
-- PRs anteriores (só grant), aqui a lógica em si precisa do guard —
-- senão qualquer authenticated (não só admin/tesoureiro) segue agindo
-- sobre qualquer igreja/filial/usuário.

-- 1) get_user_auth_context: vazava perfil completo (nome/email/
-- telefone/igreja/filial) + roles + status admin de QUALQUER user_id
-- informado. AuthContextProvider.tsx só chama com o próprio ID — a RPC
-- nunca validava isso. Guard: só o próprio usuário ou admin/
-- super_admin pode consultar contexto de outro.
CREATE OR REPLACE FUNCTION "public"."get_user_auth_context"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_profile RECORD;
  v_roles TEXT[];
  v_filiais JSONB;
  v_is_admin BOOLEAN := false;
  v_start_time TIMESTAMPTZ;
BEGIN
  -- Timeout de segurança para evitar hang
  PERFORM set_config('statement_timeout', '3000', true);

  v_start_time := clock_timestamp();

  -- Guard: só o próprio usuário, ou admin/super_admin, pode consultar
  -- o contexto de auth de um user_id.
  IF p_user_id IS DISTINCT FROM auth.uid()
     AND NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Acesso negado',
      'execution_time_ms', EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start_time))
    );
  END IF;

  -- 1. Buscar perfil do usuário
  SELECT
    id,
    user_id,
    nome,
    email,
    telefone,
    avatar_url,
    igreja_id,
    filial_id,
    status
  INTO v_profile
  FROM profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  -- Se não encontrou perfil, retorna erro
  IF v_profile.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Perfil não encontrado',
      'execution_time_ms', EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start_time))
    );
  END IF;

  -- 2. Buscar roles do usuário (coluna role é enum direto, não FK)
  SELECT array_agg(ur.role::text) INTO v_roles
  FROM user_roles ur
  WHERE ur.user_id = p_user_id
    AND (ur.igreja_id = v_profile.igreja_id OR ur.igreja_id IS NULL);

  -- Se não tem roles, array vazio
  IF v_roles IS NULL THEN
    v_roles := ARRAY[]::TEXT[];
  END IF;

  -- Verificar se é admin
  v_is_admin := ('admin' = ANY(v_roles)) OR ('super_admin' = ANY(v_roles));

  -- 3. Buscar filiais que o usuário tem acesso
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', f.id,
      'nome', f.nome,
      'is_sede', f.is_sede
    )
  ), '[]'::jsonb) INTO v_filiais
  FROM filiais f
  WHERE f.igreja_id = v_profile.igreja_id
    AND f.ativo = true
    AND (
      v_is_admin = true
      OR f.id = v_profile.filial_id
      OR EXISTS (
        SELECT 1 FROM user_filial_access ufa
        WHERE ufa.user_id = p_user_id AND ufa.filial_id = f.id
      )
    );

  -- 4. Retornar contexto completo
  RETURN jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'user_id', v_profile.user_id,
      'nome', v_profile.nome,
      'email', v_profile.email,
      'telefone', v_profile.telefone,
      'avatar_url', v_profile.avatar_url,
      'igreja_id', v_profile.igreja_id,
      'filial_id', v_profile.filial_id,
      'status', v_profile.status
    ),
    'roles', to_jsonb(v_roles),
    'is_admin', v_is_admin,
    'filiais', v_filiais,
    'execution_time_ms', EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start_time))
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'execution_time_ms', EXTRACT(MILLISECOND FROM (clock_timestamp() - v_start_time))
  );
END;
$$;

-- 2) calcular_metricas_tenant: gravava métricas agregadas (membros,
-- transações financeiras, checkins, pedidos de oração) de QUALQUER
-- igreja_id informado, sem checar quem chama. Único caller real é
-- useSuperAdmin.tsx. Guard igual à função irmã get_super_admin_dashboard.
CREATE OR REPLACE FUNCTION "public"."calcular_metricas_tenant"("p_igreja_id" "uuid", "p_data" "date" DEFAULT CURRENT_DATE) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_metrica_id UUID;
  v_total_membros INTEGER;
  v_membros_ativos INTEGER;
  v_total_eventos INTEGER;
  v_total_transacoes INTEGER;
  v_valor_transacoes NUMERIC;
  v_total_checkins INTEGER;
  v_total_pedidos INTEGER;
  v_total_chamadas INTEGER;
  v_total_erros INTEGER;
  v_latencia_media INTEGER;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado: requer papel super_admin' USING ERRCODE = '42501';
  END IF;

  -- Membros
  SELECT COUNT(*) INTO v_total_membros
  FROM public.profiles
  WHERE igreja_id = p_igreja_id AND status = 'membro';

  -- Membros ativos (com checkin nos últimos 30 dias)
  SELECT COUNT(DISTINCT pessoa_id) INTO v_membros_ativos
  FROM public.checkins c
  JOIN public.profiles p ON c.pessoa_id = p.id
  WHERE p.igreja_id = p_igreja_id
    AND c.created_at > (p_data - INTERVAL '30 days');

  -- Eventos do mês
  SELECT COUNT(*) INTO v_total_eventos
  FROM public.eventos
  WHERE igreja_id = p_igreja_id
    AND DATE_TRUNC('month', data_evento) = DATE_TRUNC('month', p_data::timestamp);

  -- Transações do mês
  SELECT COUNT(*), COALESCE(SUM(valor), 0) INTO v_total_transacoes, v_valor_transacoes
  FROM public.transacoes_financeiras
  WHERE igreja_id = p_igreja_id
    AND DATE_TRUNC('month', data_competencia) = DATE_TRUNC('month', p_data::timestamp);

  -- Checkins do mês
  SELECT COUNT(*) INTO v_total_checkins
  FROM public.checkins c
  JOIN public.profiles p ON c.pessoa_id = p.id
  WHERE p.igreja_id = p_igreja_id
    AND DATE_TRUNC('month', c.created_at) = DATE_TRUNC('month', p_data::timestamp);

  -- Pedidos de oração do mês
  SELECT COUNT(*) INTO v_total_pedidos
  FROM public.pedidos_oracao
  WHERE igreja_id = p_igreja_id
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', p_data::timestamp);

  -- Chamadas de API (simplificado - edge_function_logs não tem igreja_id)
  v_total_chamadas := 0;
  v_total_erros := 0;
  v_latencia_media := 0;

  -- Upsert na tabela de métricas
  INSERT INTO public.tenant_metricas (
    igreja_id, data_referencia,
    total_membros, membros_ativos, total_eventos,
    total_transacoes, valor_transacoes,
    total_checkins, total_pedidos_oracao,
    total_chamadas_api, total_erros_api, latencia_media_ms
  ) VALUES (
    p_igreja_id, p_data,
    v_total_membros, v_membros_ativos, v_total_eventos,
    v_total_transacoes, v_valor_transacoes,
    v_total_checkins, v_total_pedidos,
    v_total_chamadas, v_total_erros, v_latencia_media
  )
  ON CONFLICT (igreja_id, data_referencia)
  DO UPDATE SET
    total_membros = EXCLUDED.total_membros,
    membros_ativos = EXCLUDED.membros_ativos,
    total_eventos = EXCLUDED.total_eventos,
    total_transacoes = EXCLUDED.total_transacoes,
    valor_transacoes = EXCLUDED.valor_transacoes,
    total_checkins = EXCLUDED.total_checkins,
    total_pedidos_oracao = EXCLUDED.total_pedidos_oracao,
    total_chamadas_api = EXCLUDED.total_chamadas_api,
    total_erros_api = EXCLUDED.total_erros_api,
    latencia_media_ms = EXCLUDED.latencia_media_ms,
    updated_at = now()
  RETURNING id INTO v_metrica_id;

  RETURN v_metrica_id;
END;
$$;

-- 3) rejeitar_sugestao_conciliacao: rejeitava sugestão de ML de
-- conciliação bancária de QUALQUER igreja/filial informada via
-- p_sugestao_id, sem checar papel nem tenant. Guard igual ao padrão
-- fin_exigir_leitura_financeira (admin/tesoureiro) + has_filial_access
-- na igreja/filial da própria sugestão encontrada.
CREATE OR REPLACE FUNCTION "public"."rejeitar_sugestao_conciliacao"("p_sugestao_id" "uuid", "p_usuario_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sugestao RECORD;
  v_valid_usuario_id UUID;
  v_sugestoes_relacionadas UUID[];
  v_affected_count INT;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role)) THEN
    RAISE EXCEPTION 'Acesso negado: requer papel admin ou tesoureiro' USING ERRCODE = '42501';
  END IF;

  -- Buscar sugestão principal
  SELECT * INTO v_sugestao
  FROM conciliacao_ml_sugestoes
  WHERE id = p_sugestao_id AND status = 'pendente';

  IF v_sugestao IS NULL THEN
    RAISE EXCEPTION 'Sugestão não encontrada ou já processada';
  END IF;

  IF NOT has_filial_access(v_sugestao.igreja_id, v_sugestao.filial_id) THEN
    RAISE EXCEPTION 'Sem acesso à filial da sugestão' USING ERRCODE = '42501';
  END IF;

  -- Validar que usuario_id existe em profiles (se fornecido)
  IF p_usuario_id IS NOT NULL THEN
    SELECT id INTO v_valid_usuario_id
    FROM profiles
    WHERE id = p_usuario_id;
  END IF;

  -- Buscar TODAS as sugestões que envolvem os mesmos extratos E transações
  SELECT ARRAY_AGG(id) INTO v_sugestoes_relacionadas
  FROM conciliacao_ml_sugestoes
  WHERE status = 'pendente'
    AND igreja_id = v_sugestao.igreja_id
    AND extrato_ids = v_sugestao.extrato_ids
    AND transacao_ids = v_sugestao.transacao_ids;

  -- Atualizar status de TODAS as sugestões relacionadas para rejeitada
  UPDATE conciliacao_ml_sugestoes
  SET status = 'rejeitada', updated_at = now()
  WHERE id = ANY(v_sugestoes_relacionadas);

  GET DIAGNOSTICS v_affected_count = ROW_COUNT;

  -- Inserir feedback de rejeição apenas para a sugestão principal
  INSERT INTO conciliacao_ml_feedback (
    sugestao_id, igreja_id, filial_id, conta_id, tipo_match,
    extrato_ids, transacao_ids, acao, score, modelo_versao, usuario_id, ajustes
  ) VALUES (
    p_sugestao_id, v_sugestao.igreja_id, v_sugestao.filial_id, v_sugestao.conta_id,
    v_sugestao.tipo_match, v_sugestao.extrato_ids, v_sugestao.transacao_ids,
    'rejeitada', v_sugestao.score, v_sugestao.modelo_versao, v_valid_usuario_id,
    jsonb_build_object('sugestoes_rejeitadas_em_batch', v_affected_count)
  );

  RAISE NOTICE 'Rejeitadas % sugestões relacionadas', v_affected_count;

  RETURN TRUE;
END;
$$;

-- 4) open_sessao_contagem: abria/atualizava sessão de contagem de
-- oferta pra QUALQUER igreja_id/filial_id informada, sem checar papel
-- nem que o chamador pertence àquela igreja. Guard igual ao padrão
-- fin_exigir_leitura_financeira.
CREATE OR REPLACE FUNCTION "public"."open_sessao_contagem"("p_igreja_id" "uuid", "p_filial_id" "uuid", "p_data_culto" "date", "p_periodo" "text", "p_evento_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sessao_id UUID;
  v_result JSON;
  v_config RECORD;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role)) THEN
    RAISE EXCEPTION 'Acesso negado: requer papel admin ou tesoureiro' USING ERRCODE = '42501';
  END IF;

  IF get_current_user_igreja_id() IS DISTINCT FROM p_igreja_id THEN
    RAISE EXCEPTION 'igreja_id não corresponde ao usuário autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_filial_id IS NOT NULL AND NOT has_filial_access(p_igreja_id, p_filial_id) THEN
    RAISE EXCEPTION 'Sem acesso à filial informada' USING ERRCODE = '42501';
  END IF;

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

-- Nenhuma das 4 tinha grant pra anon nem a PUBLIC precisa de fix aqui
-- (achado era de lógica, não de ACL) — mas fecha PUBLIC por hygiene,
-- já que authenticated com o guard novo é suficiente.
REVOKE ALL ON FUNCTION public.get_user_auth_context(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.calcular_metricas_tenant(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rejeitar_sugestao_conciliacao(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_sessao_contagem(uuid, uuid, date, text, uuid) FROM PUBLIC, anon;

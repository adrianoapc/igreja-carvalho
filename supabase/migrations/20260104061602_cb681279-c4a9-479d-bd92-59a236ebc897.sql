-- Parte 4: Funções de super admin

-- Função para calcular métricas de um tenant
CREATE OR REPLACE FUNCTION public.calcular_metricas_tenant(p_igreja_id UUID, p_data DATE DEFAULT CURRENT_DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Função para aprovar solicitação de onboarding
CREATE OR REPLACE FUNCTION public.aprovar_onboarding(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_igreja_id UUID;
  v_filial_id UUID;
BEGIN
  -- Verificar se é super_admin
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;
  
  -- Buscar solicitação
  SELECT * INTO v_request
  FROM public.onboarding_requests
  WHERE id = p_request_id AND status = 'pendente';
  
  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada ou já processada');
  END IF;
  
  -- Criar igreja
  INSERT INTO public.igrejas (nome, cnpj, email, telefone, cidade, estado, status, aprovado_por, aprovado_em)
  VALUES (
    v_request.nome_igreja,
    v_request.cnpj,
    v_request.email,
    v_request.telefone,
    v_request.cidade,
    v_request.estado,
    'ativo',
    auth.uid(),
    now()
  )
  RETURNING id INTO v_igreja_id;
  
  -- Criar filial padrão (Matriz)
  INSERT INTO public.filiais (igreja_id, nome)
  VALUES (v_igreja_id, 'Matriz')
  RETURNING id INTO v_filial_id;
  
  -- Criar registro em configuracoes_igreja
  INSERT INTO public.configuracoes_igreja (igreja_id, nome_igreja)
  VALUES (v_igreja_id, v_request.nome_igreja);
  
  -- Atualizar solicitação
  UPDATE public.onboarding_requests
  SET 
    status = 'aprovado',
    processado_por = auth.uid(),
    processado_em = now(),
    igreja_id = v_igreja_id
  WHERE id = p_request_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'igreja_id', v_igreja_id,
    'filial_id', v_filial_id,
    'message', 'Igreja criada com sucesso.'
  );
END;
$$;

-- Função para obter dashboard do super admin
CREATE OR REPLACE FUNCTION public.get_super_admin_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_igrejas INTEGER;
  v_igrejas_ativas INTEGER;
  v_igrejas_pendentes INTEGER;
  v_solicitacoes_pendentes INTEGER;
  v_total_membros INTEGER;
  v_total_eventos_mes INTEGER;
BEGIN
  -- Verificar se é super_admin
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;
  
  SELECT COUNT(*) INTO v_total_igrejas FROM public.igrejas;
  SELECT COUNT(*) INTO v_igrejas_ativas FROM public.igrejas WHERE status = 'ativo';
  SELECT COUNT(*) INTO v_igrejas_pendentes FROM public.igrejas WHERE status = 'pendente';
  SELECT COUNT(*) INTO v_solicitacoes_pendentes FROM public.onboarding_requests WHERE status = 'pendente';
  SELECT COUNT(*) INTO v_total_membros FROM public.profiles WHERE status = 'membro';
  SELECT COUNT(*) INTO v_total_eventos_mes 
  FROM public.eventos 
  WHERE DATE_TRUNC('month', data_evento) = DATE_TRUNC('month', CURRENT_DATE);
  
  RETURN jsonb_build_object(
    'total_igrejas', v_total_igrejas,
    'igrejas_ativas', v_igrejas_ativas,
    'igrejas_pendentes', v_igrejas_pendentes,
    'solicitacoes_pendentes', v_solicitacoes_pendentes,
    'total_membros', v_total_membros,
    'total_eventos_mes', v_total_eventos_mes
  );
END;
$$;
-- =====================================================
-- MIGRATION: presencas_culto → checkins
-- =====================================================

-- 1. Renomear a tabela
ALTER TABLE public.presencas_culto RENAME TO checkins;

-- 2. Renomear coluna culto_id para evento_id (já deveria referenciar eventos)
ALTER TABLE public.checkins RENAME COLUMN culto_id TO evento_id;

-- 3. Atualizar a FK para garantir que aponta para eventos
ALTER TABLE public.checkins DROP CONSTRAINT IF EXISTS presencas_culto_culto_id_fkey;
ALTER TABLE public.checkins DROP CONSTRAINT IF EXISTS checkins_evento_id_fkey;
ALTER TABLE public.checkins 
  ADD CONSTRAINT checkins_evento_id_fkey 
  FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;

-- 4. Atualizar RLS policies
DROP POLICY IF EXISTS "Lideres gerenciam presenca" ON public.checkins;

CREATE POLICY "Lideres gerenciam checkins"
  ON public.checkins FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'secretario'::app_role)
  );

CREATE POLICY "Membros podem ver checkins"
  ON public.checkins FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 5. Atualizar função registrar_presenca_culto_kids para usar nova nomenclatura
CREATE OR REPLACE FUNCTION public.registrar_presenca_culto_kids()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Só processa se o checkout foi agora (não era nulo e agora é preenchido)
  IF OLD.checkout_at IS NULL AND NEW.checkout_at IS NOT NULL THEN
    
    -- Só registra se houver evento vinculado
    IF NEW.culto_id IS NOT NULL THEN
      
      -- 1. Registrar presença da CRIANÇA
      INSERT INTO public.checkins (
        evento_id,
        pessoa_id,
        tipo_registro
      )
      VALUES (
        NEW.culto_id,
        NEW.crianca_id,
        'kids'
      )
      ON CONFLICT (evento_id, pessoa_id) DO NOTHING;
      
      -- 2. Registrar presença do RESPONSÁVEL (pai/mãe que trouxe)
      INSERT INTO public.checkins (
        evento_id,
        pessoa_id,
        tipo_registro
      )
      VALUES (
        NEW.culto_id,
        NEW.responsavel_id,
        'adulto'
      )
      ON CONFLICT (evento_id, pessoa_id) DO NOTHING;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 6. Atualizar função get_minha_lista_chamada
CREATE OR REPLACE FUNCTION public.get_minha_lista_chamada(p_evento_id uuid)
 RETURNS TABLE(pessoa_id uuid, nome text, avatar_url text, nome_grupo text, tipo_grupo text, ja_marcado boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
BEGIN
  -- Get the current user_id
  v_user_id := auth.uid();
  
  -- Get the profile_id of the logged-in user
  SELECT id INTO v_profile_id 
  FROM public.profiles 
  WHERE user_id = v_user_id;

  RETURN QUERY
  -- Fetch members from teams where the user is the leader OR sublider
  SELECT DISTINCT
    mt.pessoa_id,
    p.nome,
    p.avatar_url,
    tc.nome AS nome_grupo,
    'ministerio'::TEXT AS tipo_grupo,
    EXISTS (
      SELECT 1 FROM public.checkins c 
      WHERE c.evento_id = p_evento_id 
      AND c.pessoa_id = mt.pessoa_id
    ) AS ja_marcado
  FROM public.membros_time mt
  INNER JOIN public.times_culto tc ON mt.time_id = tc.id
  INNER JOIN public.profiles p ON mt.pessoa_id = p.id
  WHERE (tc.lider_id = v_profile_id OR tc.sublider_id = v_profile_id)
  AND mt.ativo = true
  AND tc.ativo = true
  AND mt.pessoa_id != v_profile_id
  
  UNION ALL
  
  -- Also fetch family members of the leader/sublider
  SELECT DISTINCT
    f.familiar_id AS pessoa_id,
    COALESCE(pf.nome, f.nome_familiar) AS nome,
    pf.avatar_url,
    'Família'::TEXT AS nome_grupo,
    'celula'::TEXT AS tipo_grupo,
    EXISTS (
      SELECT 1 FROM public.checkins c 
      WHERE c.evento_id = p_evento_id 
      AND c.pessoa_id = f.familiar_id
    ) AS ja_marcado
  FROM public.familias f
  LEFT JOIN public.profiles pf ON f.familiar_id = pf.id
  WHERE f.pessoa_id = v_profile_id
  AND f.familiar_id IS NOT NULL
  
  ORDER BY nome_grupo, nome;
END;
$function$;

-- 7. Atualizar função checkin_por_localizacao
CREATE OR REPLACE FUNCTION public.checkin_por_localizacao(p_telefone text, p_lat double precision, p_long double precision)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pessoa_id UUID;
  v_evento_id UUID;
  -- Coordenadas da Igreja (configuráveis futuramente)
  const_lat_igreja FLOAT := -20.8123; 
  const_long_igreja FLOAT := -49.3765;
BEGIN
  -- 1. Achar a pessoa pelo telefone (do WhatsApp)
  SELECT id INTO v_pessoa_id 
  FROM public.profiles 
  WHERE REGEXP_REPLACE(telefone, '[^0-9]', '', 'g') = REGEXP_REPLACE(p_telefone, '[^0-9]', '', 'g');
  
  IF v_pessoa_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Telefone não encontrado');
  END IF;

  -- 2. Calcular distância (verificando raio de ~100m)
  IF abs(p_lat - const_lat_igreja) > 0.001 OR abs(p_long - const_long_igreja) > 0.001 THEN
     RETURN jsonb_build_object('success', false, 'message', 'Você parece estar longe da igreja!');
  END IF;

  -- 3. Achar o evento de HOJE (que está acontecendo agora ou próximo)
  SELECT id INTO v_evento_id 
  FROM public.eventos 
  WHERE data_evento::date = current_date 
  ORDER BY data_evento ASC
  LIMIT 1;

  IF v_evento_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nenhum evento encontrado hoje.');
  END IF;

  -- 4. Registrar presença com novo campo 'metodo'
  INSERT INTO public.checkins (evento_id, pessoa_id, metodo)
  VALUES (v_evento_id, v_pessoa_id, 'whatsapp_geo')
  ON CONFLICT (evento_id, pessoa_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'message', 'Presença confirmada!');
END;
$function$;

-- 8. Adicionar comentários de documentação
COMMENT ON TABLE public.checkins IS 'Registros de presença/check-in em eventos (antigo presencas_culto)';
COMMENT ON COLUMN public.checkins.evento_id IS 'ID do evento onde foi registrada a presença';
COMMENT ON COLUMN public.checkins.tipo_registro IS 'Tipo: manual, kids, qrcode, etc.';
COMMENT ON COLUMN public.checkins.metodo IS 'Método de check-in: app, whatsapp_geo, qrcode, etc.';
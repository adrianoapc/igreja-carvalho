-- Atualizar função para usar nova coluna 'metodo'
CREATE OR REPLACE FUNCTION public.checkin_por_localizacao(
  p_telefone TEXT,
  p_lat FLOAT,
  p_long FLOAT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pessoa_id UUID;
  v_culto_id UUID;
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

  -- 3. Achar o culto de HOJE (que está acontecendo agora ou próximo)
  SELECT id INTO v_culto_id 
  FROM public.cultos 
  WHERE data_culto::date = current_date 
  ORDER BY data_culto ASC
  LIMIT 1;

  IF v_culto_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nenhum culto encontrado hoje.');
  END IF;

  -- 4. Registrar presença com novo campo 'metodo'
  INSERT INTO public.presencas_culto (culto_id, pessoa_id, metodo)
  VALUES (v_culto_id, v_pessoa_id, 'whatsapp_geo')
  ON CONFLICT (culto_id, pessoa_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'message', 'Presença confirmada!');
END;
$$;
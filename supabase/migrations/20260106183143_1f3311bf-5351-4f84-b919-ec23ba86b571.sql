
-- Recreate function to create ALL 7 short links per filial (without 'ativo' column)
CREATE OR REPLACE FUNCTION public.create_filial_short_links(p_filial_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filial RECORD;
  v_base_slug TEXT;
  v_link_types TEXT[] := ARRAY[
    'cadastro-publico',
    'checkin', 
    'inscricao',
    'cadastro',
    'cadastro-visitante',
    'cadastro-aceitou',
    'cadastro-membro'
  ];
  v_link_type TEXT;
  v_slug TEXT;
  v_target_url TEXT;
BEGIN
  -- Get filial info
  SELECT f.*, i.nome as igreja_nome
  INTO v_filial
  FROM filiais f
  JOIN igrejas i ON i.id = f.igreja_id
  WHERE f.id = p_filial_id;

  IF v_filial IS NULL THEN
    RETURN;
  END IF;

  -- Generate base slug from filial name
  v_base_slug := generate_filial_slug(v_filial.nome);

  -- Create each link type
  FOREACH v_link_type IN ARRAY v_link_types LOOP
    -- Generate unique slug for this link type
    v_slug := v_base_slug || '-' || v_link_type;
    
    -- Ensure slug is unique
    WHILE EXISTS (SELECT 1 FROM short_links WHERE slug = v_slug) LOOP
      v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
    END LOOP;

    -- Build target URL based on link type
    CASE v_link_type
      WHEN 'cadastro-publico' THEN
        v_target_url := '/cadastro-publico?filial_id=' || p_filial_id::text;
      WHEN 'checkin' THEN
        v_target_url := '/checkin?filial_id=' || p_filial_id::text;
      WHEN 'inscricao' THEN
        v_target_url := '/inscricao?filial_id=' || p_filial_id::text;
      WHEN 'cadastro' THEN
        v_target_url := '/cadastro?filial_id=' || p_filial_id::text;
      WHEN 'cadastro-visitante' THEN
        v_target_url := '/cadastro/visitante?filial_id=' || p_filial_id::text;
      WHEN 'cadastro-aceitou' THEN
        v_target_url := '/cadastro?filial_id=' || p_filial_id::text || '&aceitou=true';
      WHEN 'cadastro-membro' THEN
        v_target_url := '/cadastro/membro?filial_id=' || p_filial_id::text;
    END CASE;

    -- Insert the short link (all are per-filial now, no is_all_filiais)
    INSERT INTO short_links (slug, target_url, igreja_id, filial_id, is_all_filiais)
    VALUES (v_slug, v_target_url, v_filial.igreja_id, p_filial_id, false)
    ON CONFLICT (slug) DO NOTHING;
  END LOOP;
END;
$$;

-- Clean up old global links (with is_all_filiais = true)
DELETE FROM short_links WHERE is_all_filiais = true;

-- Recreate links for all existing filiais (this will add the 4 new link types)
DO $$
DECLARE
  v_filial RECORD;
BEGIN
  FOR v_filial IN SELECT id FROM filiais LOOP
    -- Delete existing links for this filial to recreate all 7
    DELETE FROM short_links WHERE filial_id = v_filial.id;
    -- Create all 7 links
    PERFORM create_filial_short_links(v_filial.id);
  END LOOP;
END;
$$;

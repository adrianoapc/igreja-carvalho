-- Drop e recriar funções para evitar conflitos de parâmetros
DROP FUNCTION IF EXISTS public.remove_accents(TEXT);
DROP FUNCTION IF EXISTS public.generate_filial_slug(TEXT);

-- Função auxiliar para remover acentos
CREATE FUNCTION public.remove_accents(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    p_text,
    'àáâãäåèéêëìíîïòóôõöùúûüýÿÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝ',
    'aaaaaaeeeeiiiiooooouuuuyyAAAAAAEEEEIIIIOOOOOUUUUY'
  );
$$;

-- Função para gerar slug a partir de nome
CREATE FUNCTION public.generate_filial_slug(p_nome TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_slug TEXT;
  v_counter INTEGER := 0;
  v_base_slug TEXT;
BEGIN
  v_base_slug := lower(remove_accents(p_nome));
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9]+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '^-+|-+$', '', 'g');
  
  IF length(v_base_slug) < 4 THEN
    v_base_slug := v_base_slug || '-link';
  END IF;
  
  v_slug := v_base_slug;
  
  WHILE EXISTS (SELECT 1 FROM public.short_links WHERE slug = v_slug OR slug LIKE v_slug || '-%') LOOP
    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter::TEXT;
  END LOOP;
  
  RETURN v_slug;
END;
$$;

-- Função para criar links da filial
CREATE OR REPLACE FUNCTION public.create_filial_short_links(p_filial_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_filial RECORD;
  v_base_slug TEXT;
  v_links_config JSONB;
  v_link JSONB;
BEGIN
  SELECT f.id, f.nome, f.igreja_id INTO v_filial FROM public.filiais f WHERE f.id = p_filial_id;
  
  IF v_filial.id IS NULL THEN RETURN; END IF;
  
  v_base_slug := generate_filial_slug(v_filial.nome);
  
  v_links_config := jsonb_build_array(
    jsonb_build_object('suffix', 'cadastro', 'target', '/cadastro-publico?filial_id=' || p_filial_id::TEXT),
    jsonb_build_object('suffix', 'checkin', 'target', '/checkin?filial_id=' || p_filial_id::TEXT),
    jsonb_build_object('suffix', 'inscricao', 'target', '/inscricao?filial_id=' || p_filial_id::TEXT)
  );
  
  FOR v_link IN SELECT * FROM jsonb_array_elements(v_links_config)
  LOOP
    INSERT INTO public.short_links (slug, target_url, igreja_id, filial_id, is_all_filiais)
    VALUES (v_base_slug || '-' || (v_link->>'suffix'), v_link->>'target', v_filial.igreja_id, p_filial_id, false)
    ON CONFLICT (slug) DO NOTHING;
  END LOOP;
END;
$$;

-- Função para criar links da igreja (is_all_filiais = true)
CREATE OR REPLACE FUNCTION public.create_igreja_short_links(p_igreja_id UUID, p_filial_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_igreja_nome TEXT;
  v_base_slug TEXT;
  v_links_config JSONB;
  v_link JSONB;
BEGIN
  SELECT nome INTO v_igreja_nome FROM public.igrejas WHERE id = p_igreja_id;
  IF v_igreja_nome IS NULL THEN RETURN; END IF;
  
  v_base_slug := generate_filial_slug(v_igreja_nome);
  
  v_links_config := jsonb_build_array(
    jsonb_build_object('suffix', 'geral', 'target', '/cadastro?igreja_id=' || p_igreja_id::TEXT || '&todas_filiais=true'),
    jsonb_build_object('suffix', 'visitante', 'target', '/cadastro/visitante?igreja_id=' || p_igreja_id::TEXT || '&todas_filiais=true'),
    jsonb_build_object('suffix', 'aceitou-jesus', 'target', '/cadastro?igreja_id=' || p_igreja_id::TEXT || '&todas_filiais=true&aceitou=true'),
    jsonb_build_object('suffix', 'membro', 'target', '/cadastro/membro?igreja_id=' || p_igreja_id::TEXT || '&todas_filiais=true')
  );
  
  FOR v_link IN SELECT * FROM jsonb_array_elements(v_links_config)
  LOOP
    INSERT INTO public.short_links (slug, target_url, igreja_id, filial_id, is_all_filiais)
    VALUES (v_base_slug || '-' || (v_link->>'suffix'), v_link->>'target', p_igreja_id, p_filial_id, true)
    ON CONFLICT (slug) DO NOTHING;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.create_igreja_short_links(UUID, UUID) IS 'Cria links padrão da igreja (geral, visitante, aceitou-jesus, membro) com is_all_filiais=true';

-- Atualiza trigger para criar ambos os tipos de links
CREATE OR REPLACE FUNCTION public.trigger_create_filial_short_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM create_filial_short_links(NEW.id);
  PERFORM create_igreja_short_links(NEW.igreja_id, NEW.id);
  RETURN NEW;
END;
$$;

-- Inserir links para igrejas existentes
DO $$
DECLARE
  v_igreja RECORD;
  v_primeira_filial_id UUID;
BEGIN
  FOR v_igreja IN 
    SELECT DISTINCT i.id FROM public.igrejas i
    WHERE NOT EXISTS (SELECT 1 FROM public.short_links sl WHERE sl.igreja_id = i.id AND sl.is_all_filiais = true)
  LOOP
    SELECT id INTO v_primeira_filial_id FROM public.filiais WHERE igreja_id = v_igreja.id ORDER BY created_at LIMIT 1;
    PERFORM create_igreja_short_links(v_igreja.id, v_primeira_filial_id);
  END LOOP;
END;
$$;
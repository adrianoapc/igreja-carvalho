-- Função para remover acentos manualmente (sem depender de extensão)
CREATE OR REPLACE FUNCTION public.remove_accents(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN translate(
    p_text,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇñÑ',
    'aaaaaeeeeiiiioooouuuucAAAAAEEEEIIIIOOOOOUUUUCnN'
  );
END;
$$;

-- Função para gerar slug único baseado no nome da filial
CREATE OR REPLACE FUNCTION public.generate_filial_slug(p_nome TEXT, p_igreja_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Gera slug base: lowercase, remove acentos, substitui espaços por hífens
  base_slug := lower(public.remove_accents(p_nome));
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := regexp_replace(base_slug, '^-|-$', '', 'g');
  
  -- Garante mínimo de 4 caracteres
  IF char_length(base_slug) < 4 THEN
    base_slug := base_slug || '-fil';
  END IF;
  
  final_slug := base_slug;
  
  -- Verifica unicidade e adiciona sufixo se necessário
  WHILE EXISTS (SELECT 1 FROM public.short_links WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter::TEXT;
  END LOOP;
  
  RETURN final_slug;
END;
$$;

-- Função para criar short_links padrão para uma filial
CREATE OR REPLACE FUNCTION public.create_filial_short_links(
  p_filial_id UUID,
  p_filial_nome TEXT,
  p_igreja_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  slug_cadastro TEXT;
  slug_checkin TEXT;
  slug_inscricao TEXT;
BEGIN
  -- Gera slugs únicos para cada tipo de link
  slug_cadastro := public.generate_filial_slug(p_filial_nome || '-cadastro', p_igreja_id);
  slug_checkin := public.generate_filial_slug(p_filial_nome || '-checkin', p_igreja_id);
  slug_inscricao := public.generate_filial_slug(p_filial_nome || '-inscricao', p_igreja_id);
  
  -- Cria link para cadastro público
  INSERT INTO public.short_links (slug, target_url, igreja_id, filial_id, is_all_filiais)
  VALUES (
    slug_cadastro,
    '/cadastro-publico?filial=' || p_filial_id::TEXT,
    p_igreja_id,
    p_filial_id,
    false
  )
  ON CONFLICT (slug) DO NOTHING;
  
  -- Cria link para check-in
  INSERT INTO public.short_links (slug, target_url, igreja_id, filial_id, is_all_filiais)
  VALUES (
    slug_checkin,
    '/checkin?filial=' || p_filial_id::TEXT,
    p_igreja_id,
    p_filial_id,
    false
  )
  ON CONFLICT (slug) DO NOTHING;
  
  -- Cria link para inscrição em eventos
  INSERT INTO public.short_links (slug, target_url, igreja_id, filial_id, is_all_filiais)
  VALUES (
    slug_inscricao,
    '/inscricao?filial=' || p_filial_id::TEXT,
    p_igreja_id,
    p_filial_id,
    false
  )
  ON CONFLICT (slug) DO NOTHING;
END;
$$;

-- Trigger function para criar short_links automaticamente
CREATE OR REPLACE FUNCTION public.trigger_create_filial_short_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.create_filial_short_links(NEW.id, NEW.nome, NEW.igreja_id);
  RETURN NEW;
END;
$$;

-- Cria trigger na tabela filiais
DROP TRIGGER IF EXISTS on_filial_created_short_links ON public.filiais;
CREATE TRIGGER on_filial_created_short_links
  AFTER INSERT ON public.filiais
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_filial_short_links();

-- Insere short_links para todas as filiais existentes
DO $$
DECLARE
  filial_record RECORD;
BEGIN
  FOR filial_record IN 
    SELECT f.id, f.nome, f.igreja_id 
    FROM public.filiais f
    WHERE NOT EXISTS (
      SELECT 1 FROM public.short_links sl 
      WHERE sl.filial_id = f.id
    )
  LOOP
    PERFORM public.create_filial_short_links(
      filial_record.id, 
      filial_record.nome, 
      filial_record.igreja_id
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.remove_accents(TEXT) IS 'Remove acentos de texto para geração de slugs';
COMMENT ON FUNCTION public.generate_filial_slug(TEXT, UUID) IS 'Gera slug único para short_links baseado no nome da filial';
COMMENT ON FUNCTION public.create_filial_short_links(UUID, TEXT, UUID) IS 'Cria short_links padrão (cadastro, checkin, inscricao) para uma filial';
COMMENT ON FUNCTION public.trigger_create_filial_short_links() IS 'Trigger function para criar short_links automaticamente ao inserir filial';
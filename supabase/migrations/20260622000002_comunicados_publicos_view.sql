-- =====================================================================
-- Banners públicos no site institucional
-- Fonte: tabela comunicados (tipo='banner', exibir_site=true)
-- =====================================================================

-- VIEW pública: expõe apenas as colunas necessárias ao site
-- e aplica os filtros de vigência em tempo real (via WHERE com now()).
-- Não expõe: created_by, updated_at, tags, culto_id/evento_id.
CREATE OR REPLACE VIEW public.comunicados_publicos AS
SELECT
  id,
  titulo,
  descricao,
  imagem_url,
  link_acao,
  nivel_urgencia,
  created_at
FROM public.comunicados
WHERE
  tipo        = 'banner'
  AND exibir_site = true
  AND ativo       = true
  AND (data_inicio IS NULL OR data_inicio <= now())
  AND (data_fim    IS NULL OR data_fim    >= now());

-- Grants explícitos: o anon e authenticated só enxergam a VIEW,
-- nunca a tabela comunicados diretamente.
GRANT SELECT ON public.comunicados_publicos TO anon;
GRANT SELECT ON public.comunicados_publicos TO authenticated;

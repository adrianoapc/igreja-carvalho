-- =====================================================================
-- Agenda pública no site institucional
-- =====================================================================

-- 1. Flag de publicação (nova coluna em eventos)
ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS publicar_no_site BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.eventos.publicar_no_site IS
  'Quando TRUE, o evento aparece na agenda pública do site institucional';

-- 2. VIEW pública
--    · Filtra: publicar_no_site = true, data futura, não cancelado/realizado
--    · Expõe apenas colunas necessárias para o site (sem dados internos)
--    · Subconsulta opcional: imagem do primeiro comunicado vinculado ao evento
CREATE OR REPLACE VIEW public.eventos_publicos AS
SELECT
  e.id,
  e.titulo,
  e.descricao,
  e.data_evento,
  e.local,
  e.endereco,
  e.tipo::text            AS tipo,
  e.status,
  e.requer_inscricao,
  e.valor_inscricao,
  e.vagas_limite,
  e.inscricoes_abertas_ate,
  -- imagem do comunicado/banner vinculado ao evento (opcional)
  (
    SELECT c.imagem_url
    FROM   public.comunicados c
    WHERE  c.evento_id = e.id
      AND  c.imagem_url IS NOT NULL
      AND  c.ativo      = true
    ORDER  BY c.created_at DESC
    LIMIT  1
  ) AS banner_url
FROM  public.eventos e
WHERE e.publicar_no_site = true
  AND e.data_evento       > now()
  AND e.status NOT IN ('cancelado', 'realizado');

-- 3. Grants explícitos para roles anon e authenticated
GRANT SELECT ON public.eventos_publicos TO anon;
GRANT SELECT ON public.eventos_publicos TO authenticated;

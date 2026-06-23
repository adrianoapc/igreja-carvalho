-- Força o reload do schema cache do PostgREST recriando as VIEWs públicas.
-- Necessário porque o pg_notify direto não alcança o PostgREST no Supabase Cloud;
-- apenas a infraestrutura do `db push` aciona o restart do PostgREST.

-- ── comunicados_publicos ──────────────────────────────────────────────────────
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

GRANT SELECT ON public.comunicados_publicos TO anon;
GRANT SELECT ON public.comunicados_publicos TO authenticated;

-- ── eventos_publicos ──────────────────────────────────────────────────────────
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

GRANT SELECT ON public.eventos_publicos TO anon;
GRANT SELECT ON public.eventos_publicos TO authenticated;

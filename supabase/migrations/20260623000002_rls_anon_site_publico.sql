-- =========================================================================
-- RLS para acesso anônimo ao site público
-- Contexto: comunicados_publicos e eventos_publicos são views, mas as
-- tabelas subjacentes têm RLS ativo. O role anon precisa de políticas
-- explícitas nas tabelas base para que as views retornem dados.
-- =========================================================================

-- ── comunicados: anon vê apenas banners públicos vigentes ────────────────
DROP POLICY IF EXISTS "anon_banners_site" ON public.comunicados;
CREATE POLICY "anon_banners_site" ON public.comunicados
  FOR SELECT
  TO anon
  USING (
    tipo::text  = 'banner'
    AND exibir_site = true
    AND ativo       = true
    AND (data_inicio IS NULL OR data_inicio <= now())
    AND (data_fim    IS NULL OR data_fim    >= now())
  );

-- ── eventos: anon vê apenas eventos marcados para publicação ────────────
DROP POLICY IF EXISTS "anon_eventos_site" ON public.eventos;
CREATE POLICY "anon_eventos_site" ON public.eventos
  FOR SELECT
  TO anon
  USING (
    publicar_no_site = true
    AND data_evento   > now()
    AND status NOT IN ('cancelado', 'realizado')
  );

-- Recarregar schema cache
NOTIFY pgrst, 'reload schema';

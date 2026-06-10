-- A migration 20260608131528 revogou SELECT de anon em short_links,
-- quebrando o redirect público de /s/:slug. Esta migration restaura o acesso.
DROP POLICY IF EXISTS "short_links_select_same_church" ON public.short_links;

GRANT SELECT ON public.short_links TO anon;

CREATE POLICY "short_links_select_public"
ON public.short_links
FOR SELECT
TO anon, authenticated
USING (expires_at IS NULL OR expires_at > now());

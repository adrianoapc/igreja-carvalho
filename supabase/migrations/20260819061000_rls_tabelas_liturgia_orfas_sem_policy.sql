-- Linter Supabase (rls_disabled_in_public): 5 tabelas do módulo antigo de
-- "cultos" (pré cultos→eventos, migration 20251228153548) estão expostas via
-- PostgREST com RLS desligado E, confirmado ao vivo via pg_policies, SEM
-- NENHUMA policy hoje (a policy original de cada uma, escrita na migration
-- de criação, não existe mais em produção — drift; provavelmente removida
-- manualmente durante a limpeza do módulo "liturgias"/eventos).
--
-- Confirmado ao vivo (supabase db query --linked) antes de escrever esta
-- migration, para não ligar RLS às cegas e travar algo em uso:
--   * cultos, times_culto, escalas_culto, liturgia_culto, midias_culto,
--     templates_liturgia, itens_template_liturgia, presencas_culto: 0 linhas
--     em produção (tabelas mortas).
--   * Nenhuma referência a essas tabelas em src/ (grep) — o módulo foi
--     substituído por eventos/liturgias; só times_culto/liturgia_culto/
--     midias_culto (cobertas na migration anterior) ainda têm policy viva,
--     as 5 desta migration não têm nenhuma.
--   * cultos/templates_liturgia/itens_template_liturgia/presencas_culto NÃO
--     têm coluna igreja_id/filial_id (nunca passaram pelo refactor
--     multi-tenant) — não dá pra usar has_filial_access nelas.
--   * escalas_culto TEM igreja_id (NOT NULL) + filial_id (nullable),
--     adicionadas depois da criação original — por isso ela usa o padrão
--     atual (has_filial_access), igual às tabelas-irmãs times_culto/
--     liturgia_culto/midias_culto (já corrigidas na migration anterior).
--
-- Como a tabela está vazia e não é usada pelo app hoje, o risco de "quebrar
-- alguém" é zero; as policies abaixo partem do desenho original de cada
-- tabela (documentado nas migrations de criação: 20251130023429,
-- 20251130062803, 20251203013050) — mas SEM repetir o "membro autenticado
-- vê tudo" (USING true) do desenho original: `cultos` não tem igreja_id
-- nem nenhuma coluna pra restringir por status/ativo (diferente de
-- templates_liturgia/itens_template_liturgia, que ao menos filtram por
-- `ativo`), então qualquer grant de SELECT pra `authenticated` seria
-- necessariamente cross-tenant (achado no code-review desta PR). Fica
-- admin-only, igual ao padrão já usado pra presencas_culto neste mesmo
-- arquivo — se o módulo for reativado, quem adicionar igreja_id/filial_id
-- decide ali a política de leitura correta.

-- cultos (sem igreja_id/filial_id)
CREATE POLICY "Admins podem gerenciar cultos"
  ON public.cultos
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.cultos ENABLE ROW LEVEL SECURITY;

-- templates_liturgia (sem igreja_id/filial_id)
CREATE POLICY "Admins podem gerenciar templates"
  ON public.templates_liturgia
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver templates ativos"
  ON public.templates_liturgia
  FOR SELECT
  TO authenticated
  USING (ativo = true OR has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.templates_liturgia ENABLE ROW LEVEL SECURITY;

-- itens_template_liturgia (sem igreja_id/filial_id)
CREATE POLICY "Admins podem gerenciar itens de templates"
  ON public.itens_template_liturgia
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver itens de templates ativos"
  ON public.itens_template_liturgia
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.templates_liturgia
      WHERE id = itens_template_liturgia.template_id
      AND (ativo = true OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

ALTER TABLE public.itens_template_liturgia ENABLE ROW LEVEL SECURITY;

-- presencas_culto (sem igreja_id/filial_id) — desenho original: só
-- admin/secretário enxergam algo, nem o próprio aluno tinha SELECT.
CREATE POLICY "Lideres gerenciam presenca"
  ON public.presencas_culto
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretario'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretario'::app_role));

ALTER TABLE public.presencas_culto ENABLE ROW LEVEL SECURITY;

-- escalas_culto (TEM igreja_id/filial_id) — padrão atual das irmãs
-- times_culto/liturgia_culto/midias_culto (has_filial_access), não o
-- desenho original de 20251130023429 (que não tinha essas colunas).
CREATE POLICY "Admins podem gerenciar escalas"
  ON public.escalas_culto
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND has_filial_access(igreja_id, filial_id));

CREATE POLICY "Membros podem ver escalas"
  ON public.escalas_culto
  FOR SELECT
  TO authenticated
  USING (has_filial_access(igreja_id, filial_id));

ALTER TABLE public.escalas_culto ENABLE ROW LEVEL SECURITY;

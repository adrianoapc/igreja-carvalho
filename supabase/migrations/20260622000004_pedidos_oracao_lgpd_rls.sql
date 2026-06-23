-- =====================================================================
-- Pedidos de Oração — Reescrita completa das políticas RLS
-- Princípio: anon nunca lê dados de terceiros; need-to-know para intercessores
-- =====================================================================

-- ── Passo 1: Remover TODAS as políticas existentes ────────────────────
-- Necessário: migrações anteriores criaram sobreposições graves:
--   "Todos podem criar pedidos"               → WITH CHECK (true), sem TO → qualquer role insere sem restrição
--   "Admins e intercessores podem gerenciar"  → FOR ALL → intercessor lê/deleta qualquer pedido
-- A varredura dinâmica garante idempotência mesmo que nomes mudem no futuro.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM   pg_policies
    WHERE  tablename  = 'pedidos_oracao'
      AND  schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.pedidos_oracao', r.policyname
    );
  END LOOP;
END $$;

-- ── POLÍTICA 1: anon INSERT — formulário público do site ──────────────
-- Quem:  role anon (visitante não autenticado)
-- O quê: apenas INSERT; SELECT / UPDATE / DELETE continuam bloqueados por padrão
-- Por que cada cláusula no WITH CHECK:
--   origem = 'site'              → bloqueia tentativas de forjar canal (whatsapp, app)
--   consentimento_em IS NOT NULL → LGPD art. 7º II: coleta sem consentimento é nula
--   status = 'pendente'          → anon não força outro status
--   intercessor_id IS NULL       → anon não se auto-designa intercessor
--   classificacao = 'PESSOAL'    → anon não cria pedidos BROADCAST
-- Nota: a Edge Function receber-pedido-make usa service_role e não passa aqui.
CREATE POLICY "anon_insert_pedido_site"
  ON public.pedidos_oracao
  FOR INSERT
  TO anon
  WITH CHECK (
    origem            = 'site'
    AND consentimento_em IS NOT NULL
    AND status        = 'pendente'
    AND intercessor_id IS NULL
    AND classificacao = 'PESSOAL'
  );

-- ── POLÍTICA 2: authenticated INSERT — app interno ────────────────────
-- Quem:  qualquer usuário autenticado (membro logado no app)
-- O quê: INSERT na filial do usuário; status deve ser 'pendente'
-- Nota: Edge Function usa service_role — não passa por esta política.
CREATE POLICY "authenticated_insert_pedido_app"
  ON public.pedidos_oracao
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status             = 'pendente'
    AND intercessor_id IS NULL
    AND has_filial_access(igreja_id, filial_id)
  );

-- ── POLÍTICA 3: SELECT — admin e pastor (acesso irrestrito) ──────────
-- Quem:  roles admin ou pastor
-- O quê: TODOS os pedidos da filial, incluindo confidenciais
-- Por quê: admin e pastor são responsáveis pelo tratamento (LGPD art. 37)
--           e têm obrigação pastoral de cuidado integral.
CREATE POLICY "admin_pastor_select_todos"
  ON public.pedidos_oracao
  FOR SELECT
  TO authenticated
  USING (
    (   has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'pastor'::app_role)
    )
    AND has_filial_access(igreja_id, filial_id)
  );

-- ── POLÍTICA 4: SELECT — intercessor (somente designados, não-confidenciais)
-- Quem:  usuário presente em public.intercessores com ativo = true
-- O quê: pedidos DESIGNADOS a ele E com confidencial = false
-- Por quê: need-to-know — intercessor não precisa ver pedidos de outros
--           nem conteúdo sensível além de sua capacidade de acompanhar.
-- Efeito: pedido com confidencial = true fica invisível aqui mesmo que o
--          intercessor esteja designado; admin/pastor assumem esses casos.
CREATE POLICY "intercessor_select_designados_nao_confidenciais"
  ON public.pedidos_oracao
  FOR SELECT
  TO authenticated
  USING (
    confidencial = false
    AND intercessor_id IN (
      SELECT id FROM public.intercessores
      WHERE  user_id = auth.uid() AND ativo = true
    )
    AND has_filial_access(igreja_id, filial_id)
  );

-- ── POLÍTICA 5: UPDATE — admin e pastor (todos os campos) ────────────
CREATE POLICY "admin_pastor_update_todos"
  ON public.pedidos_oracao
  FOR UPDATE
  TO authenticated
  USING (
    (   has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'pastor'::app_role)
    )
    AND has_filial_access(igreja_id, filial_id)
  )
  WITH CHECK (
    (   has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'pastor'::app_role)
    )
    AND has_filial_access(igreja_id, filial_id)
  );

-- ── POLÍTICA 6: UPDATE — intercessor (linhas designadas) ────────────
-- Quem:  intercessor ativo
-- O quê: atualiza pedidos designados a ele (ex.: status, observacoes_intercessor)
-- Limitação de design: RLS não restringe quais colunas dentro da linha —
--   isso é responsabilidade da camada de aplicação (formulário exibe apenas
--   status e observacoes_intercessor; dados pessoais do solicitante não aparecem
--   na tela de edição do intercessor).
-- Intercessor NÃO pode: mudar confidencial, dados pessoais do solicitante,
--   re-designar para outro intercessor (esses campos ficam fora da UI).
CREATE POLICY "intercessor_update_designados"
  ON public.pedidos_oracao
  FOR UPDATE
  TO authenticated
  USING (
    intercessor_id IN (
      SELECT id FROM public.intercessores
      WHERE  user_id = auth.uid() AND ativo = true
    )
    AND has_filial_access(igreja_id, filial_id)
  )
  WITH CHECK (
    intercessor_id IN (
      SELECT id FROM public.intercessores
      WHERE  user_id = auth.uid() AND ativo = true
    )
    AND has_filial_access(igreja_id, filial_id)
  );

-- ── POLÍTICA 7: DELETE — somente admin ───────────────────────────────
-- Exclusão manual excepcional. O expurgo automático usa SECURITY DEFINER
-- e não depende desta política.
CREATE POLICY "admin_delete_pedidos"
  ON public.pedidos_oracao
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

-- Segurança por padrão: RLS ativo + nenhuma política para anon SELECT/UPDATE/DELETE
-- = acesso negado automaticamente pelo Postgres. Não é necessário política explícita
-- de negação — a ausência de permissão já nega.

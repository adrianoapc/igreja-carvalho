
-- =============================================
-- RLS Contextual: Líderes/Sublíderes podem gerenciar seus times
-- =============================================

-- Função auxiliar para verificar se pessoa é líder/sublíder de um time
CREATE OR REPLACE FUNCTION public.is_time_leader(p_user_id UUID, p_time_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM times t
    JOIN profiles p ON p.user_id = p_user_id
    WHERE t.id = p_time_id
    AND (t.lider_id = p.id OR t.sublider_id = p.id)
  )
$$;

-- =========================
-- ESCALAS: Líderes podem gerenciar escalas dos seus times
-- =========================

-- Remover política antiga de admin-only para escalas
DROP POLICY IF EXISTS "Admin gerencia escalas de eventos" ON escalas;

-- Admin gerencia todas as escalas
CREATE POLICY "Admin gerencia todas escalas"
ON escalas FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND has_filial_access(igreja_id, filial_id)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND has_filial_access(igreja_id, filial_id)
);

-- Líderes/Sublíderes podem gerenciar escalas do seu time
CREATE POLICY "Lider gerencia escalas do seu time"
ON escalas FOR ALL TO authenticated
USING (
  is_time_leader(auth.uid(), time_id)
  AND has_filial_access(igreja_id, filial_id)
)
WITH CHECK (
  is_time_leader(auth.uid(), time_id)
  AND has_filial_access(igreja_id, filial_id)
);

-- =========================
-- MEMBROS_TIME: Líderes podem gerenciar membros dos seus times
-- =========================

-- Remover política antiga de admin-only
DROP POLICY IF EXISTS "Admins podem gerenciar membros de times" ON membros_time;

-- Admin gerencia todos os membros de times
CREATE POLICY "Admin gerencia todos membros de times"
ON membros_time FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  AND has_filial_access(igreja_id, filial_id)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  AND has_filial_access(igreja_id, filial_id)
);

-- Líderes/Sublíderes podem gerenciar membros do seu time
CREATE POLICY "Lider gerencia membros do seu time"
ON membros_time FOR ALL TO authenticated
USING (
  is_time_leader(auth.uid(), time_id)
  AND has_filial_access(igreja_id, filial_id)
)
WITH CHECK (
  is_time_leader(auth.uid(), time_id)
  AND has_filial_access(igreja_id, filial_id)
);

-- =========================
-- TIMES: Líderes podem atualizar seus próprios times
-- =========================

-- Líderes podem atualizar dados do seu time (não criar/deletar)
CREATE POLICY "Lider atualiza seu time"
ON times FOR UPDATE TO authenticated
USING (
  is_time_leader(auth.uid(), id)
  AND has_filial_access(igreja_id, filial_id)
)
WITH CHECK (
  is_time_leader(auth.uid(), id)
  AND has_filial_access(igreja_id, filial_id)
);

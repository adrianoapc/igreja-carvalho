-- Atualizar políticas de eventos e escalas
DROP POLICY IF EXISTS "Admin gerencia eventos" ON public.eventos;
CREATE POLICY "Admin gerencia eventos" ON public.eventos
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND public.has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "Membros visualizam eventos" ON public.eventos;
CREATE POLICY "Membros visualizam eventos" ON public.eventos
  FOR SELECT
  USING (public.has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "Admin gerencia escalas de eventos" ON public.escalas;
CREATE POLICY "Admin gerencia escalas de eventos" ON public.escalas
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND public.has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "Membros visualizam escalas" ON public.escalas;
CREATE POLICY "Membros visualizam escalas" ON public.escalas
  FOR SELECT
  USING (public.has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "Voluntario confirma propria escala" ON public.escalas;
CREATE POLICY "Voluntario confirma propria escala" ON public.escalas
  FOR UPDATE
  USING (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND public.has_filial_access(igreja_id, filial_id));

-- Atualizar políticas de profiles (apenas admin policies)
DROP POLICY IF EXISTS "admins_can_view_all_profiles" ON public.profiles;
CREATE POLICY "admins_can_view_all_profiles" ON public.profiles
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) AND public.has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "admins_can_update_any_profile" ON public.profiles;
CREATE POLICY "admins_can_update_any_profile" ON public.profiles
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND public.has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "admins_can_create_profiles" ON public.profiles;
CREATE POLICY "admins_can_create_profiles" ON public.profiles
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND public.has_filial_access(igreja_id, filial_id));

-- Atualizar políticas de famílias
DROP POLICY IF EXISTS "Admins podem ver todos os relacionamentos familiares" ON public.familias;
CREATE POLICY "Admins podem ver todos os relacionamentos familiares" ON public.familias
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) AND public.has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "Admins podem atualizar relacionamentos familiares" ON public.familias;
CREATE POLICY "Admins podem atualizar relacionamentos familiares" ON public.familias
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND public.has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "Admins podem deletar relacionamentos familiares" ON public.familias;
CREATE POLICY "Admins podem deletar relacionamentos familiares" ON public.familias
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) AND public.has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "admins_can_manage_families" ON public.familias;
CREATE POLICY "admins_can_manage_families" ON public.familias
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND public.has_filial_access(igreja_id, filial_id));
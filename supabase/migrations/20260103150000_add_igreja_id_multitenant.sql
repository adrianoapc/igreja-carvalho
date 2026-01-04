-- =====================================================
-- MIGRAÇÃO: Adicionar igreja_id para multi-tenant
-- =====================================================

-- 1. Adicionar colunas igreja_id
ALTER TABLE public.contas ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.bases_ministeriais ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.centros_custo ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.categorias_financeiras ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.subcategorias_financeiras ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.transacoes_financeiras ADD COLUMN IF NOT EXISTS igreja_id UUID;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.familias ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.visitante_contatos ADD COLUMN IF NOT EXISTS igreja_id UUID;

ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.times_culto ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.posicoes_time ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.membros_time ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.liturgia_culto ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.cancoes_culto ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.midias_culto ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.eventos_convites ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.inscricoes_eventos ADD COLUMN IF NOT EXISTS igreja_id UUID;

ALTER TABLE IF EXISTS public.escalas ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE IF EXISTS public.escalas_culto ADD COLUMN IF NOT EXISTS igreja_id UUID;

-- 2. Backfill igreja_id com a configuração singleton existente
DO $$
DECLARE
  v_igreja_id UUID;
BEGIN
  SELECT id INTO v_igreja_id FROM public.configuracoes_igreja ORDER BY created_at LIMIT 1;

  IF v_igreja_id IS NULL THEN
    INSERT INTO public.configuracoes_igreja (nome_igreja, subtitulo)
    VALUES ('Igreja App', 'Gestão Completa')
    RETURNING id INTO v_igreja_id;
  END IF;

  UPDATE public.contas SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.bases_ministeriais SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.centros_custo SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.categorias_financeiras SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.subcategorias_financeiras SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.fornecedores SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.transacoes_financeiras SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;

  UPDATE public.profiles SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.familias SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.visitante_contatos SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;

  UPDATE public.eventos SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.times_culto SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.posicoes_time SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.membros_time SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.liturgia_culto SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.cancoes_culto SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.midias_culto SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.eventos_convites SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  UPDATE public.inscricoes_eventos SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'escalas') THEN
    UPDATE public.escalas SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'escalas_culto') THEN
    UPDATE public.escalas_culto SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  END IF;
END $$;

-- 3. Adicionar FKs
ALTER TABLE public.contas
  ADD CONSTRAINT contas_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.bases_ministeriais
  ADD CONSTRAINT bases_ministeriais_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.centros_custo
  ADD CONSTRAINT centros_custo_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.categorias_financeiras
  ADD CONSTRAINT categorias_financeiras_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.subcategorias_financeiras
  ADD CONSTRAINT subcategorias_financeiras_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.fornecedores
  ADD CONSTRAINT fornecedores_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.transacoes_financeiras
  ADD CONSTRAINT transacoes_financeiras_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.familias
  ADD CONSTRAINT familias_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.visitante_contatos
  ADD CONSTRAINT visitante_contatos_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);

ALTER TABLE public.eventos
  ADD CONSTRAINT eventos_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.times_culto
  ADD CONSTRAINT times_culto_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.posicoes_time
  ADD CONSTRAINT posicoes_time_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.membros_time
  ADD CONSTRAINT membros_time_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.liturgia_culto
  ADD CONSTRAINT liturgia_culto_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.cancoes_culto
  ADD CONSTRAINT cancoes_culto_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.midias_culto
  ADD CONSTRAINT midias_culto_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.eventos_convites
  ADD CONSTRAINT eventos_convites_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE public.inscricoes_eventos
  ADD CONSTRAINT inscricoes_eventos_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);

ALTER TABLE IF EXISTS public.escalas
  ADD CONSTRAINT escalas_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);
ALTER TABLE IF EXISTS public.escalas_culto
  ADD CONSTRAINT escalas_culto_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.configuracoes_igreja(id);

-- 4. Tornar igreja_id obrigatório
ALTER TABLE public.contas ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.bases_ministeriais ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.centros_custo ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.categorias_financeiras ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.subcategorias_financeiras ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.fornecedores ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.transacoes_financeiras ALTER COLUMN igreja_id SET NOT NULL;

ALTER TABLE public.profiles ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.familias ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.visitante_contatos ALTER COLUMN igreja_id SET NOT NULL;

ALTER TABLE public.eventos ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.times_culto ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.posicoes_time ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.membros_time ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.liturgia_culto ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.cancoes_culto ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.midias_culto ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.eventos_convites ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE public.inscricoes_eventos ALTER COLUMN igreja_id SET NOT NULL;

ALTER TABLE IF EXISTS public.escalas ALTER COLUMN igreja_id SET NOT NULL;
ALTER TABLE IF EXISTS public.escalas_culto ALTER COLUMN igreja_id SET NOT NULL;

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_contas_igreja_id ON public.contas(igreja_id);
CREATE INDEX IF NOT EXISTS idx_bases_ministeriais_igreja_id ON public.bases_ministeriais(igreja_id);
CREATE INDEX IF NOT EXISTS idx_centros_custo_igreja_id ON public.centros_custo(igreja_id);
CREATE INDEX IF NOT EXISTS idx_categorias_financeiras_igreja_id ON public.categorias_financeiras(igreja_id);
CREATE INDEX IF NOT EXISTS idx_subcategorias_financeiras_igreja_id ON public.subcategorias_financeiras(igreja_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_igreja_id ON public.fornecedores(igreja_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_financeiras_igreja_id ON public.transacoes_financeiras(igreja_id);

CREATE INDEX IF NOT EXISTS idx_profiles_igreja_id ON public.profiles(igreja_id);
CREATE INDEX IF NOT EXISTS idx_familias_igreja_id ON public.familias(igreja_id);
CREATE INDEX IF NOT EXISTS idx_visitante_contatos_igreja_id ON public.visitante_contatos(igreja_id);

CREATE INDEX IF NOT EXISTS idx_eventos_igreja_id ON public.eventos(igreja_id);
CREATE INDEX IF NOT EXISTS idx_times_culto_igreja_id ON public.times_culto(igreja_id);
CREATE INDEX IF NOT EXISTS idx_posicoes_time_igreja_id ON public.posicoes_time(igreja_id);
CREATE INDEX IF NOT EXISTS idx_membros_time_igreja_id ON public.membros_time(igreja_id);
CREATE INDEX IF NOT EXISTS idx_liturgia_culto_igreja_id ON public.liturgia_culto(igreja_id);
CREATE INDEX IF NOT EXISTS idx_cancoes_culto_igreja_id ON public.cancoes_culto(igreja_id);
CREATE INDEX IF NOT EXISTS idx_midias_culto_igreja_id ON public.midias_culto(igreja_id);
CREATE INDEX IF NOT EXISTS idx_eventos_convites_igreja_id ON public.eventos_convites(igreja_id);
CREATE INDEX IF NOT EXISTS idx_inscricoes_eventos_igreja_id ON public.inscricoes_eventos(igreja_id);

CREATE INDEX IF NOT EXISTS idx_escalas_igreja_id ON public.escalas(igreja_id);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'escalas_culto') THEN
    CREATE INDEX IF NOT EXISTS idx_escalas_culto_igreja_id ON public.escalas_culto(igreja_id);
  END IF;
END $$;

-- 6. RLS: filtrar por igreja_id
ALTER POLICY "Admins e tesoureiros podem gerenciar contas" ON public.contas
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins e tesoureiros podem gerenciar bases ministeriais" ON public.bases_ministeriais
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins e tesoureiros podem gerenciar centros de custo" ON public.centros_custo
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins e tesoureiros podem gerenciar categorias" ON public.categorias_financeiras
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins e tesoureiros podem gerenciar subcategorias" ON public.subcategorias_financeiras
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "only_admins_treasurers_can_view_suppliers" ON public.fornecedores
  USING ((public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'tesoureiro'::app_role))
    AND auth.uid() IS NOT NULL
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "only_admins_treasurers_can_create_suppliers" ON public.fornecedores
  WITH CHECK ((public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'tesoureiro'::app_role))
    AND auth.uid() IS NOT NULL
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "only_admins_treasurers_can_update_suppliers" ON public.fornecedores
  USING ((public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'tesoureiro'::app_role))
    AND auth.uid() IS NOT NULL
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK ((public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'tesoureiro'::app_role))
    AND auth.uid() IS NOT NULL
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "only_admins_can_delete_suppliers" ON public.fornecedores
  USING (public.has_role(auth.uid(), 'admin'::app_role)
    AND auth.uid() IS NOT NULL
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins e tesoureiros podem gerenciar transações" ON public.transacoes_financeiras
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "users_can_view_own_profile" ON public.profiles
  USING (auth.uid() = user_id
    AND auth.uid() IS NOT NULL
    AND user_id IS NOT NULL
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "admins_can_view_all_profiles" ON public.profiles
  USING (public.has_role(auth.uid(), 'admin'::app_role)
    AND auth.uid() IS NOT NULL
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "users_can_update_own_profile" ON public.profiles
  USING (auth.uid() = user_id
    AND auth.uid() IS NOT NULL
    AND user_id IS NOT NULL
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (auth.uid() = user_id
    AND auth.uid() IS NOT NULL
    AND user_id IS NOT NULL
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "admins_can_update_any_profile" ON public.profiles
  USING (public.has_role(auth.uid(), 'admin'::app_role)
    AND auth.uid() IS NOT NULL
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role)
    AND auth.uid() IS NOT NULL
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "admins_can_create_profiles" ON public.profiles
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role)
    AND auth.uid() IS NOT NULL
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins podem ver todos os relacionamentos familiares" ON public.familias
  USING (has_role(auth.uid(), 'admin')
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins podem criar relacionamentos familiares" ON public.familias
  WITH CHECK (has_role(auth.uid(), 'admin')
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins podem atualizar relacionamentos familiares" ON public.familias
  USING (has_role(auth.uid(), 'admin')
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (has_role(auth.uid(), 'admin')
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins podem deletar relacionamentos familiares" ON public.familias
  USING (has_role(auth.uid(), 'admin')
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Membros podem ver seus próprios relacionamentos" ON public.familias
  USING (
    (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      OR familiar_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid
  );

ALTER POLICY "Admins podem ver todos os contatos" ON public.visitante_contatos
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins podem criar contatos" ON public.visitante_contatos
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins podem atualizar contatos" ON public.visitante_contatos
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins podem deletar contatos" ON public.visitante_contatos
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Membros responsáveis podem ver seus contatos" ON public.visitante_contatos
  USING (membro_responsavel_id = auth.uid()
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Membros responsáveis podem atualizar seus contatos" ON public.visitante_contatos
  USING (membro_responsavel_id = auth.uid()
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (membro_responsavel_id = auth.uid()
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admin gerencia eventos" ON public.eventos
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Membros visualizam eventos" ON public.eventos
  USING (igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins podem gerenciar times" ON public.times_culto
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Membros podem ver times ativos" ON public.times_culto
  USING ((ativo = true OR has_role(auth.uid(), 'admin'::app_role))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins podem gerenciar posições" ON public.posicoes_time
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Membros podem ver posições ativas" ON public.posicoes_time
  USING ((ativo = true OR has_role(auth.uid(), 'admin'::app_role))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins podem gerenciar membros de times" ON public.membros_time
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Membros podem ver membros de times" ON public.membros_time
  USING (true
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admin gerencia escalas de eventos" ON public.escalas
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Membros visualizam escalas" ON public.escalas
  USING (true
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Voluntario confirma propria escala" ON public.escalas
  USING (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins podem gerenciar liturgia" ON public.liturgia_culto
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Membros podem ver liturgia" ON public.liturgia_culto
  USING (true
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins podem gerenciar canções" ON public.cancoes_culto
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Membros podem ver canções" ON public.cancoes_culto
  USING (true
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins podem gerenciar mídias" ON public.midias_culto
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Membros podem ver mídias" ON public.midias_culto
  USING (true
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admin e lider podem ver todos os convites" ON public.eventos_convites
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Usuario pode ver seus proprios convites" ON public.eventos_convites
  USING (pessoa_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admin pode criar convites" ON public.eventos_convites
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Usuario pode responder seu convite" ON public.eventos_convites
  USING (pessoa_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (pessoa_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admin pode atualizar convites" ON public.eventos_convites
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admin pode deletar convites" ON public.eventos_convites
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Admins podem gerenciar inscricoes_eventos" ON public.inscricoes_eventos
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Usuarios podem ver proprias inscricoes" ON public.inscricoes_eventos
  USING (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Usuarios podem criar proprias inscricoes" ON public.inscricoes_eventos
  WITH CHECK (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

ALTER POLICY "Responsaveis podem ver inscricoes criadas" ON public.inscricoes_eventos
  USING (responsavel_inscricao_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND igreja_id = (current_setting('request.jwt.claims', true)::json->>'igreja_id')::uuid);

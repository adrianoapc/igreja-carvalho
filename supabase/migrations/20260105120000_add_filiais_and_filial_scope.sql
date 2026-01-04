-- =====================================================
-- MIGRAÇÃO: Adicionar filiais e escopo por filial
-- =====================================================

-- 1. Novas roles para escopo de igreja/filial
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_igreja';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_filial';

-- Atualizar função has_role para considerar admins por igreja/filial
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
  OR (
    _role = 'admin'::public.app_role
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id AND role IN ('admin_igreja'::public.app_role, 'admin_filial'::public.app_role)
    )
  )
$$;

-- 2. Helpers para claims JWT
CREATE OR REPLACE FUNCTION public.get_jwt_igreja_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'igreja_id'), '')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.get_jwt_filial_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.filial_id', true), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'filial_id'), '')::uuid
  );
$$;

-- 3. Atualizar helper de igreja para considerar JWT
CREATE OR REPLACE FUNCTION public.get_current_user_igreja_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE(
    public.get_jwt_igreja_id(),
    (
      SELECT igreja_id
      FROM public.profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );
END;
$$;

-- 4. Helper de filial
CREATE OR REPLACE FUNCTION public.get_current_user_filial_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE(
    public.get_jwt_filial_id(),
    (
      SELECT filial_id
      FROM public.profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );
END;
$$;

-- 5. Função de escopo por igreja/filial
CREATE OR REPLACE FUNCTION public.has_filial_access(_igreja_id UUID, _filial_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      _igreja_id = public.get_jwt_igreja_id()
      AND (
        has_role(auth.uid(), 'admin_igreja'::app_role)
        OR (
          public.get_jwt_filial_id() IS NOT NULL
          AND _filial_id = public.get_jwt_filial_id()
        )
      )
    );
$$;

-- 6. Criar tabela de filiais
CREATE TABLE IF NOT EXISTS public.filiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_filiais_updated_at ON public.filiais;
CREATE TRIGGER update_filiais_updated_at
  BEFORE UPDATE ON public.filiais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE UNIQUE INDEX IF NOT EXISTS filiais_igreja_nome_unique
  ON public.filiais (igreja_id, nome);

-- RLS em filiais
ALTER TABLE public.filiais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios podem ver filiais da igreja" ON public.filiais;
CREATE POLICY "Usuarios podem ver filiais da igreja"
  ON public.filiais
  FOR SELECT
  USING (igreja_id = public.get_jwt_igreja_id());

DROP POLICY IF EXISTS "Admin igreja gerencia filiais" ON public.filiais;
CREATE POLICY "Admin igreja gerencia filiais"
  ON public.filiais
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'admin_igreja'::app_role)
  )
  WITH CHECK (
    igreja_id = public.get_jwt_igreja_id()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'admin_igreja'::app_role)
    )
  );

-- Inserir filial padrão para cada igreja
INSERT INTO public.filiais (igreja_id, nome)
SELECT id, 'Matriz'
FROM public.igrejas
WHERE NOT EXISTS (
  SELECT 1
  FROM public.filiais fil
  WHERE fil.igreja_id = igrejas.id
);

-- Helper para filial padrão por igreja
CREATE OR REPLACE FUNCTION public.get_default_filial_id(_igreja_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT id
  FROM public.filiais
  WHERE igreja_id = _igreja_id
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- 7. Adicionar filial_id às tabelas operacionais
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'igreja_id'
      AND table_name NOT IN (
        'igrejas',
        'filiais',
        'configuracoes_igreja',
        'app_config',
        'module_permissions',
        'app_permissions',
        'app_roles',
        'role_permissions',
        'role_permissions_audit',
        'user_roles',
        'user_app_roles'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS filial_id UUID;', r.table_name);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN filial_id SET DEFAULT public.get_current_user_filial_id();', r.table_name);
    EXECUTE format('UPDATE public.%I SET filial_id = public.get_default_filial_id(igreja_id) WHERE filial_id IS NULL;', r.table_name);

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE constraint_name = r.table_name || '_filial_id_fkey'
        AND table_name = r.table_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (filial_id) REFERENCES public.filiais(id);',
        r.table_name,
        r.table_name || '_filial_id_fkey'
      );
    END IF;

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(filial_id);',
      'idx_' || r.table_name || '_filial_id',
      r.table_name
    );

    -- Mantém a coluna nullable para suportar operações de serviço sem claims explícitas
  END LOOP;
END $$;

-- 8. Atualizar políticas RLS com escopo de filial
ALTER POLICY "Admins e tesoureiros podem gerenciar contas" ON public.contas
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins e tesoureiros podem gerenciar bases ministeriais" ON public.bases_ministeriais
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins e tesoureiros podem gerenciar centros de custo" ON public.centros_custo
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins e tesoureiros podem gerenciar categorias" ON public.categorias_financeiras
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins e tesoureiros podem gerenciar subcategorias" ON public.subcategorias_financeiras
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "only_admins_treasurers_can_view_suppliers" ON public.fornecedores
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "only_admins_treasurers_can_create_suppliers" ON public.fornecedores
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "only_admins_treasurers_can_update_suppliers" ON public.fornecedores
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "only_admins_can_delete_suppliers" ON public.fornecedores
  USING (has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins e tesoureiros podem gerenciar transações" ON public.transacoes_financeiras
  USING ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK ((has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'))
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "users_can_view_own_profile" ON public.profiles
  USING (auth.uid() = user_id
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "admins_can_view_all_profiles" ON public.profiles
  USING (public.has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "users_can_update_own_profile" ON public.profiles
  USING (auth.uid() = user_id
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "admins_can_update_any_profile" ON public.profiles
  USING (public.has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "admins_can_create_profiles" ON public.profiles
  WITH CHECK (public.has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem ver todos os relacionamentos familiares" ON public.familias
  USING (public.has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem criar relacionamentos familiares" ON public.familias
  WITH CHECK (public.has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem atualizar relacionamentos familiares" ON public.familias
  USING (public.has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem deletar relacionamentos familiares" ON public.familias
  USING (public.has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Membros podem ver seus próprios relacionamentos" ON public.familias
  USING (responsavel_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem ver todos os contatos" ON public.visitante_contatos
  USING (public.has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem criar contatos" ON public.visitante_contatos
  WITH CHECK (public.has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem atualizar contatos" ON public.visitante_contatos
  USING (public.has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (public.has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem deletar contatos" ON public.visitante_contatos
  USING (public.has_role(auth.uid(), 'admin')
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Membros responsáveis podem ver seus contatos" ON public.visitante_contatos
  USING (responsavel_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Membros responsáveis podem atualizar seus contatos" ON public.visitante_contatos
  USING (responsavel_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (responsavel_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admin gerencia eventos" ON public.eventos
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Membros visualizam eventos" ON public.eventos
  USING (true
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem gerenciar times" ON public.times_culto
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Membros podem ver times ativos" ON public.times_culto
  USING (ativo = true
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem gerenciar posições" ON public.posicoes_time
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Membros podem ver posições ativas" ON public.posicoes_time
  USING (ativo = true
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem gerenciar membros de times" ON public.membros_time
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Membros podem ver membros de times" ON public.membros_time
  USING (true
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admin gerencia escalas de eventos" ON public.escalas
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Membros visualizam escalas" ON public.escalas
  USING (true
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Voluntario confirma propria escala" ON public.escalas
  USING (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem gerenciar liturgia" ON public.liturgia_culto
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Membros podem ver liturgia" ON public.liturgia_culto
  USING (true
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem gerenciar canções" ON public.cancoes_culto
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Membros podem ver canções" ON public.cancoes_culto
  USING (true
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem gerenciar mídias" ON public.midias_culto
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Membros podem ver mídias" ON public.midias_culto
  USING (true
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admin e lider podem ver todos os convites" ON public.eventos_convites
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Usuario pode ver seus proprios convites" ON public.eventos_convites
  USING (convidado_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admin pode criar convites" ON public.eventos_convites
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Usuario pode responder seu convite" ON public.eventos_convites
  USING (convidado_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (convidado_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admin pode atualizar convites" ON public.eventos_convites
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admin pode deletar convites" ON public.eventos_convites
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Admins podem gerenciar inscricoes_eventos" ON public.inscricoes_eventos
  USING (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role)
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Usuarios podem ver proprias inscricoes" ON public.inscricoes_eventos
  USING (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Usuarios podem criar proprias inscricoes" ON public.inscricoes_eventos
  WITH CHECK (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND public.has_filial_access(igreja_id, filial_id));

ALTER POLICY "Responsaveis podem ver inscricoes criadas" ON public.inscricoes_eventos
  USING (responsavel_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND public.has_filial_access(igreja_id, filial_id));

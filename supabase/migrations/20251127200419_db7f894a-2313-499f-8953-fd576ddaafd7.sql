-- Criar enum para status de usuário
CREATE TYPE public.user_status AS ENUM ('visitante', 'frequentador', 'membro');

-- Criar enum para níveis de acesso
CREATE TYPE public.access_level AS ENUM ('visualizar', 'criar_editar', 'aprovar_gerenciar', 'acesso_completo');

-- Criar enum para cargos/roles
CREATE TYPE public.app_role AS ENUM ('admin', 'pastor', 'lider', 'secretario', 'tesoureiro', 'professor', 'membro');

-- Tabela de profiles de usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  status public.user_status NOT NULL DEFAULT 'visitante',
  data_primeira_visita TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_cadastro_membro TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de roles dos membros
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Tabela de permissões por módulo
CREATE TABLE public.module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module_name TEXT NOT NULL,
  access_level public.access_level NOT NULL,
  UNIQUE(role, module_name)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

-- Função para verificar se usuário tem uma role específica
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
$$;

-- Função para verificar se usuário é membro
CREATE OR REPLACE FUNCTION public.is_member(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id AND status = 'membro'
  )
$$;

-- Função para obter nível de acesso do usuário em um módulo
CREATE OR REPLACE FUNCTION public.get_user_module_access(_user_id UUID, _module_name TEXT)
RETURNS public.access_level
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mp.access_level
  FROM public.user_roles ur
  JOIN public.module_permissions mp ON ur.role = mp.role
  WHERE ur.user_id = _user_id AND mp.module_name = _module_name
  ORDER BY 
    CASE mp.access_level
      WHEN 'acesso_completo' THEN 4
      WHEN 'aprovar_gerenciar' THEN 3
      WHEN 'criar_editar' THEN 2
      WHEN 'visualizar' THEN 1
    END DESC
  LIMIT 1
$$;

-- RLS Policies para profiles
CREATE POLICY "Usuários podem ver seu próprio perfil"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todos os perfis"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins podem atualizar qualquer perfil"
ON public.profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem criar perfis"
ON public.profiles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para user_roles
CREATE POLICY "Usuários podem ver suas próprias roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todas as roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem gerenciar roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies para module_permissions
CREATE POLICY "Todos podem ver permissões de módulos"
ON public.module_permissions FOR SELECT
USING (true);

CREATE POLICY "Admins podem gerenciar permissões"
ON public.module_permissions FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir permissões padrão para módulos
INSERT INTO public.module_permissions (role, module_name, access_level) VALUES
-- Admin tem acesso completo a tudo
('admin', 'dashboard', 'acesso_completo'),
('admin', 'membros', 'acesso_completo'),
('admin', 'visitantes', 'acesso_completo'),
('admin', 'kids', 'acesso_completo'),
('admin', 'oracoes', 'acesso_completo'),
('admin', 'testemunhos', 'acesso_completo'),
('admin', 'cultos', 'acesso_completo'),
('admin', 'financas', 'acesso_completo'),
('admin', 'ensinamentos', 'acesso_completo'),
('admin', 'banners', 'acesso_completo'),

-- Pastor tem acesso completo exceto finanças (aprovar)
('pastor', 'dashboard', 'acesso_completo'),
('pastor', 'membros', 'acesso_completo'),
('pastor', 'visitantes', 'acesso_completo'),
('pastor', 'kids', 'aprovar_gerenciar'),
('pastor', 'oracoes', 'acesso_completo'),
('pastor', 'testemunhos', 'acesso_completo'),
('pastor', 'cultos', 'acesso_completo'),
('pastor', 'financas', 'aprovar_gerenciar'),
('pastor', 'ensinamentos', 'acesso_completo'),
('pastor', 'banners', 'acesso_completo'),

-- Líder tem acesso gerencial em alguns módulos
('lider', 'dashboard', 'visualizar'),
('lider', 'membros', 'visualizar'),
('lider', 'visitantes', 'criar_editar'),
('lider', 'kids', 'criar_editar'),
('lider', 'oracoes', 'aprovar_gerenciar'),
('lider', 'testemunhos', 'aprovar_gerenciar'),
('lider', 'cultos', 'visualizar'),
('lider', 'ensinamentos', 'visualizar'),

-- Secretário tem acesso administrativo
('secretario', 'dashboard', 'visualizar'),
('secretario', 'membros', 'criar_editar'),
('secretario', 'visitantes', 'criar_editar'),
('secretario', 'cultos', 'criar_editar'),
('secretario', 'banners', 'criar_editar'),

-- Tesoureiro focado em finanças
('tesoureiro', 'dashboard', 'visualizar'),
('tesoureiro', 'financas', 'acesso_completo'),

-- Professor focado em kids e ensinamentos
('professor', 'dashboard', 'visualizar'),
('professor', 'kids', 'criar_editar'),
('professor', 'ensinamentos', 'criar_editar'),

-- Membro básico apenas visualiza
('membro', 'dashboard', 'visualizar'),
('membro', 'oracoes', 'criar_editar'),
('membro', 'testemunhos', 'criar_editar');
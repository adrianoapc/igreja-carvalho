-- =====================================================
-- SCHEMA COMPLETO DO BANCO DE DADOS
-- Igreja App - Lovable Cloud (Supabase)
-- Gerado em: 2025-12-03
-- =====================================================

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE public.app_role AS ENUM ('admin', 'secretario', 'tesoureiro', 'membro', 'basico');
CREATE TYPE public.access_level AS ENUM ('visualizar', 'criar_editar', 'aprovar_gerenciar', 'acesso_completo');
CREATE TYPE public.user_status AS ENUM ('visitante', 'frequentador', 'membro');
CREATE TYPE public.status_pedido AS ENUM ('pendente', 'em_oracao', 'respondido', 'arquivado');
CREATE TYPE public.tipo_pedido AS ENUM ('saude', 'financeiro', 'familiar', 'espiritual', 'outro');
CREATE TYPE public.categoria_testemunho AS ENUM ('cura', 'provisao', 'restauracao', 'libertacao', 'outro');
CREATE TYPE public.status_testemunho AS ENUM ('aberto', 'publico', 'arquivado');
CREATE TYPE public.tipo_sentimento AS ENUM ('feliz', 'grato', 'em_paz', 'esperancoso', 'angustiado', 'triste', 'sozinho', 'com_medo', 'doente', 'com_pouca_fe');

-- =====================================================
-- TABELAS
-- =====================================================

-- -----------------------------------------------------
-- Tabela: profiles
-- -----------------------------------------------------
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  sexo TEXT,
  data_nascimento DATE,
  estado_civil TEXT,
  cpf TEXT,
  rg TEXT,
  nacionalidade TEXT,
  naturalidade TEXT,
  profissao TEXT,
  escolaridade TEXT,
  tipo_sanguineo TEXT,
  necessidades_especiais TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  status public.user_status NOT NULL DEFAULT 'visitante',
  status_igreja TEXT DEFAULT 'ativo',
  data_primeira_visita TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_ultima_visita TIMESTAMP WITH TIME ZONE,
  numero_visitas INTEGER NOT NULL DEFAULT 1,
  data_cadastro_membro TIMESTAMP WITH TIME ZONE,
  data_conversao DATE,
  batizado BOOLEAN DEFAULT false,
  data_batismo DATE,
  data_casamento DATE,
  data_entrada DATE,
  entrou_por TEXT,
  entrevistado_por TEXT,
  cadastrado_por TEXT,
  aceitou_jesus BOOLEAN DEFAULT false,
  deseja_contato BOOLEAN DEFAULT true,
  recebeu_brinde BOOLEAN DEFAULT false,
  e_lider BOOLEAN DEFAULT false,
  e_pastor BOOLEAN DEFAULT false,
  avatar_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Policies para profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_view_all_profiles" ON public.profiles
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() IS NOT NULL);

CREATE POLICY "admins_can_create_profiles" ON public.profiles
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() IS NOT NULL);

CREATE POLICY "admins_can_update_any_profile" ON public.profiles
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() IS NOT NULL)
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() IS NOT NULL);

CREATE POLICY "users_can_view_own_profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id AND auth.uid() IS NOT NULL AND user_id IS NOT NULL);

CREATE POLICY "users_can_create_own_profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL AND user_id IS NOT NULL);

CREATE POLICY "users_can_update_own_profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id AND auth.uid() IS NOT NULL AND user_id IS NOT NULL)
  WITH CHECK (auth.uid() = user_id AND auth.uid() IS NOT NULL AND user_id IS NOT NULL);

-- -----------------------------------------------------
-- Tabela: user_roles
-- -----------------------------------------------------
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- -----------------------------------------------------
-- Tabela: module_permissions
-- -----------------------------------------------------
CREATE TABLE public.module_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role public.app_role NOT NULL,
  module_name TEXT NOT NULL,
  access_level public.access_level NOT NULL
);

ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar permissões" ON public.module_permissions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Todos podem ver permissões de módulos" ON public.module_permissions
  FOR SELECT USING (true);

-- -----------------------------------------------------
-- Tabela: notifications
-- -----------------------------------------------------
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  related_user_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sistema pode criar notificações" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Usuários podem ver suas notificações" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas notificações" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- -----------------------------------------------------
-- Tabela: banners
-- -----------------------------------------------------
CREATE TABLE public.banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver banners no período" ON public.banners
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR is_banner_active(active, scheduled_at, expires_at));

CREATE POLICY "Admins podem criar banners" ON public.banners
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar banners" ON public.banners
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar banners" ON public.banners
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: configuracoes_igreja
-- -----------------------------------------------------
CREATE TABLE public.configuracoes_igreja (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_igreja TEXT NOT NULL DEFAULT 'Igreja App',
  subtitulo TEXT DEFAULT 'Gestão Completa',
  logo_url TEXT,
  webhook_make_liturgia TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.configuracoes_igreja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver configurações" ON public.configuracoes_igreja
  FOR SELECT USING (true);

CREATE POLICY "Admins podem atualizar configurações" ON public.configuracoes_igreja
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: funcoes_igreja
-- -----------------------------------------------------
CREATE TABLE public.funcoes_igreja (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.funcoes_igreja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver funções ativas" ON public.funcoes_igreja
  FOR SELECT USING (ativo = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem criar funções" ON public.funcoes_igreja
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar funções" ON public.funcoes_igreja
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar funções" ON public.funcoes_igreja
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: membro_funcoes
-- -----------------------------------------------------
CREATE TABLE public.membro_funcoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  membro_id UUID NOT NULL,
  funcao_id UUID NOT NULL REFERENCES public.funcoes_igreja(id),
  data_inicio DATE DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.membro_funcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todas as atribuições" ON public.membro_funcoes
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver suas próprias funções" ON public.membro_funcoes
  FOR SELECT USING (membro_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins podem criar atribuições" ON public.membro_funcoes
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar atribuições" ON public.membro_funcoes
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar atribuições" ON public.membro_funcoes
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: familias
-- -----------------------------------------------------
CREATE TABLE public.familias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id UUID NOT NULL,
  familiar_id UUID,
  nome_familiar TEXT,
  tipo_parentesco TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.familias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os relacionamentos familiares" ON public.familias
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver seus próprios relacionamentos" ON public.familias
  FOR SELECT USING (
    pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
    familiar_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins podem criar relacionamentos familiares" ON public.familias
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar relacionamentos familiares" ON public.familias
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar relacionamentos familiares" ON public.familias
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: alteracoes_perfil_pendentes
-- -----------------------------------------------------
CREATE TABLE public.alteracoes_perfil_pendentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL,
  dados_antigos JSONB NOT NULL,
  dados_novos JSONB NOT NULL,
  campos_aprovados JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendente',
  aprovado_por UUID,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.alteracoes_perfil_pendentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view pending changes" ON public.alteracoes_perfil_pendentes
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretario'::app_role));

CREATE POLICY "Admins can update pending changes" ON public.alteracoes_perfil_pendentes
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'secretario'::app_role));

CREATE POLICY "Edge function can insert pending changes" ON public.alteracoes_perfil_pendentes
  FOR INSERT WITH CHECK (true);

-- -----------------------------------------------------
-- Tabela: intercessores
-- -----------------------------------------------------
CREATE TABLE public.intercessores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  ativo BOOLEAN DEFAULT true,
  max_pedidos INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.intercessores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os intercessores" ON public.intercessores
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Intercessores podem ver seu próprio perfil" ON public.intercessores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins podem criar intercessores" ON public.intercessores
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar intercessores" ON public.intercessores
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar intercessores" ON public.intercessores
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: pedidos_oracao
-- -----------------------------------------------------
CREATE TABLE public.pedidos_oracao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id UUID,
  membro_id UUID,
  intercessor_id UUID,
  pedido TEXT NOT NULL,
  tipo public.tipo_pedido NOT NULL DEFAULT 'outro',
  status public.status_pedido NOT NULL DEFAULT 'pendente',
  anonimo BOOLEAN DEFAULT false,
  nome_solicitante TEXT,
  email_solicitante TEXT,
  telefone_solicitante TEXT,
  observacoes_intercessor TEXT,
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_alocacao TIMESTAMP WITH TIME ZONE,
  data_resposta TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.pedidos_oracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os pedidos" ON public.pedidos_oracao
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Intercessores podem ver pedidos alocados a eles" ON public.pedidos_oracao
  FOR SELECT USING (intercessor_id IN (SELECT id FROM intercessores WHERE user_id = auth.uid()));

CREATE POLICY "Membros podem ver seus próprios pedidos" ON public.pedidos_oracao
  FOR SELECT USING (membro_id = auth.uid());

CREATE POLICY "Todos podem criar pedidos" ON public.pedidos_oracao
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins podem atualizar pedidos" ON public.pedidos_oracao
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Intercessores podem atualizar seus pedidos alocados" ON public.pedidos_oracao
  FOR UPDATE USING (intercessor_id IN (SELECT id FROM intercessores WHERE user_id = auth.uid()));

CREATE POLICY "Admins podem deletar pedidos" ON public.pedidos_oracao
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: testemunhos
-- -----------------------------------------------------
CREATE TABLE public.testemunhos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  autor_id UUID,
  pessoa_id UUID,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  categoria public.categoria_testemunho NOT NULL DEFAULT 'outro',
  status public.status_testemunho NOT NULL DEFAULT 'aberto',
  anonimo BOOLEAN DEFAULT false,
  publicar BOOLEAN NOT NULL DEFAULT false,
  data_publicacao TIMESTAMP WITH TIME ZONE,
  nome_externo TEXT,
  email_externo TEXT,
  telefone_externo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.testemunhos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os testemunhos" ON public.testemunhos
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Autores podem ver seus próprios testemunhos" ON public.testemunhos
  FOR SELECT USING (autor_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins podem atualizar qualquer testemunho" ON public.testemunhos
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Autores podem atualizar seus próprios testemunhos" ON public.testemunhos
  FOR UPDATE USING (autor_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins podem deletar testemunhos" ON public.testemunhos
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: sentimentos_membros
-- -----------------------------------------------------
CREATE TABLE public.sentimentos_membros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id UUID NOT NULL,
  sentimento public.tipo_sentimento NOT NULL,
  mensagem TEXT,
  data_registro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sentimentos_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver todos os sentimentos" ON public.sentimentos_membros
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver seus próprios sentimentos" ON public.sentimentos_membros
  FOR SELECT USING (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Membros podem criar seus sentimentos" ON public.sentimentos_membros
  FOR INSERT WITH CHECK (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- -----------------------------------------------------
-- Tabela: cultos
-- -----------------------------------------------------
CREATE TABLE public.cultos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  data_culto TIMESTAMP WITH TIME ZONE NOT NULL,
  duracao_minutos INTEGER,
  local TEXT,
  endereco TEXT,
  tema TEXT,
  pregador TEXT,
  exibir_preletor BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'planejado',
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cultos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver cultos" ON public.cultos
  FOR SELECT USING (true);

CREATE POLICY "Admins podem gerenciar cultos" ON public.cultos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: liturgia_culto
-- -----------------------------------------------------
CREATE TABLE public.liturgia_culto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  culto_id UUID NOT NULL REFERENCES public.cultos(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  duracao_minutos INTEGER,
  responsavel_id UUID,
  responsavel_externo TEXT,
  midias_ids UUID[] DEFAULT '{}'::uuid[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.liturgia_culto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver liturgia" ON public.liturgia_culto
  FOR SELECT USING (true);

CREATE POLICY "Admins podem gerenciar liturgia" ON public.liturgia_culto
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: cancoes_culto
-- -----------------------------------------------------
CREATE TABLE public.cancoes_culto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  culto_id UUID NOT NULL REFERENCES public.cultos(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  artista TEXT,
  tom TEXT,
  bpm INTEGER,
  duracao_minutos INTEGER,
  letra TEXT,
  cifra TEXT,
  link_youtube TEXT,
  link_spotify TEXT,
  observacoes TEXT,
  solista_id UUID,
  ministro_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cancoes_culto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver canções" ON public.cancoes_culto
  FOR SELECT USING (true);

CREATE POLICY "Admins podem gerenciar canções" ON public.cancoes_culto
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: categorias_times
-- -----------------------------------------------------
CREATE TABLE public.categorias_times (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#8B5CF6',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver categorias ativas" ON public.categorias_times
  FOR SELECT USING (ativo = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem gerenciar categorias" ON public.categorias_times
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: times (implícita - referenciada por posicoes_time)
-- -----------------------------------------------------
-- Nota: A tabela times não está listada explicitamente no schema fornecido,
-- mas é referenciada por outras tabelas

-- -----------------------------------------------------
-- Tabela: posicoes_time
-- -----------------------------------------------------
CREATE TABLE public.posicoes_time (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.posicoes_time ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver posições ativas" ON public.posicoes_time
  FOR SELECT USING (ativo = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem gerenciar posições" ON public.posicoes_time
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: membros_time
-- -----------------------------------------------------
CREATE TABLE public.membros_time (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_id UUID NOT NULL,
  pessoa_id UUID NOT NULL,
  posicao_id UUID,
  data_entrada DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.membros_time ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver membros de times" ON public.membros_time
  FOR SELECT USING (true);

CREATE POLICY "Admins podem gerenciar membros de times" ON public.membros_time
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: escalas_culto
-- -----------------------------------------------------
CREATE TABLE public.escalas_culto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  culto_id UUID NOT NULL REFERENCES public.cultos(id) ON DELETE CASCADE,
  time_id UUID NOT NULL,
  pessoa_id UUID NOT NULL,
  posicao_id UUID,
  confirmado BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.escalas_culto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver escalas" ON public.escalas_culto
  FOR SELECT USING (true);

CREATE POLICY "Membros podem confirmar suas próprias escalas" ON public.escalas_culto
  FOR UPDATE USING (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins podem gerenciar escalas" ON public.escalas_culto
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: templates_culto
-- -----------------------------------------------------
CREATE TABLE public.templates_culto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT DEFAULT 'Geral',
  tipo_culto TEXT,
  tema_padrao TEXT,
  local_padrao TEXT,
  duracao_padrao INTEGER,
  pregador_padrao TEXT,
  observacoes_padrao TEXT,
  incluir_escalas BOOLEAN DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.templates_culto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver templates ativos" ON public.templates_culto
  FOR SELECT USING (ativo = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem gerenciar templates" ON public.templates_culto
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: itens_template_culto
-- -----------------------------------------------------
CREATE TABLE public.itens_template_culto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.templates_culto(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  duracao_minutos INTEGER,
  responsavel_externo TEXT,
  midias_ids UUID[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.itens_template_culto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver itens de templates ativos" ON public.itens_template_culto
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM templates_culto
    WHERE templates_culto.id = itens_template_culto.template_id
    AND (templates_culto.ativo = true OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Admins podem gerenciar itens de templates" ON public.itens_template_culto
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: escalas_template
-- -----------------------------------------------------
CREATE TABLE public.escalas_template (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.templates_culto(id) ON DELETE CASCADE,
  time_id UUID NOT NULL,
  pessoa_id UUID,
  posicao_id UUID,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.escalas_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver escalas de templates ativos" ON public.escalas_template
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM templates_culto
    WHERE templates_culto.id = escalas_template.template_id
    AND (templates_culto.ativo = true OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Admins podem gerenciar escalas de templates" ON public.escalas_template
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: midias
-- -----------------------------------------------------
CREATE TABLE public.midias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL,
  url TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'telao',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  culto_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.midias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros podem ver mídias" ON public.midias
  FOR SELECT USING (true);

CREATE POLICY "Admins podem gerenciar mídias" ON public.midias
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: tags_midias
-- -----------------------------------------------------
CREATE TABLE public.tags_midias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#8B5CF6',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.tags_midias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver tags ativas" ON public.tags_midias
  FOR SELECT USING (ativo = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem gerenciar tags de mídias" ON public.tags_midias
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: midia_tags
-- -----------------------------------------------------
CREATE TABLE public.midia_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  midia_id UUID NOT NULL REFERENCES public.midias(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags_midias(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.midia_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver relações mídia-tags" ON public.midia_tags
  FOR SELECT USING (true);

CREATE POLICY "Admins podem gerenciar relação mídia-tags" ON public.midia_tags
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- -----------------------------------------------------
-- Tabela: contas (Financeiro)
-- -----------------------------------------------------
CREATE TABLE public.contas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  banco TEXT,
  agencia TEXT,
  conta_numero TEXT,
  saldo_inicial NUMERIC NOT NULL DEFAULT 0,
  saldo_atual NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e tesoureiros podem gerenciar contas" ON public.contas
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role));

-- -----------------------------------------------------
-- Tabela: bases_ministeriais
-- -----------------------------------------------------
CREATE TABLE public.bases_ministeriais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  responsavel_id UUID,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bases_ministeriais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e tesoureiros podem gerenciar bases ministeriais" ON public.bases_ministeriais
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role));

-- -----------------------------------------------------
-- Tabela: categorias_financeiras
-- -----------------------------------------------------
CREATE TABLE public.categorias_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  cor TEXT,
  secao_dre TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e tesoureiros podem gerenciar categorias" ON public.categorias_financeiras
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role));

-- -----------------------------------------------------
-- Tabela: subcategorias_financeiras
-- -----------------------------------------------------
CREATE TABLE public.subcategorias_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id UUID NOT NULL REFERENCES public.categorias_financeiras(id),
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subcategorias_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e tesoureiros podem gerenciar subcategorias" ON public.subcategorias_financeiras
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role));

-- -----------------------------------------------------
-- Tabela: centros_custo
-- -----------------------------------------------------
CREATE TABLE public.centros_custo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  base_ministerial_id UUID,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e tesoureiros podem gerenciar centros de custo" ON public.centros_custo
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role));

-- -----------------------------------------------------
-- Tabela: formas_pagamento
-- -----------------------------------------------------
CREATE TABLE public.formas_pagamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e tesoureiros podem gerenciar formas de pagamento" ON public.formas_pagamento
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role));

-- -----------------------------------------------------
-- Tabela: fornecedores
-- -----------------------------------------------------
CREATE TABLE public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo_pessoa TEXT NOT NULL,
  cpf_cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "only_admins_treasurers_can_view_suppliers" ON public.fornecedores
  FOR SELECT USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role)) AND auth.uid() IS NOT NULL);

CREATE POLICY "only_admins_treasurers_can_create_suppliers" ON public.fornecedores
  FOR INSERT WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role)) AND auth.uid() IS NOT NULL);

CREATE POLICY "only_admins_treasurers_can_update_suppliers" ON public.fornecedores
  FOR UPDATE USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role)) AND auth.uid() IS NOT NULL)
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role)) AND auth.uid() IS NOT NULL);

CREATE POLICY "only_admins_can_delete_suppliers" ON public.fornecedores
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() IS NOT NULL);

-- -----------------------------------------------------
-- Tabela: transacoes_financeiras
-- -----------------------------------------------------
CREATE TABLE public.transacoes_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  valor_liquido NUMERIC,
  tipo TEXT NOT NULL, -- 'entrada' ou 'saida'
  tipo_lancamento TEXT NOT NULL, -- 'avulso', 'parcelado', 'recorrente'
  status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'pago'
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  data_competencia DATE,
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  subcategoria_id UUID REFERENCES public.subcategorias_financeiras(id),
  centro_custo_id UUID REFERENCES public.centros_custo(id),
  base_ministerial_id UUID REFERENCES public.bases_ministeriais(id),
  fornecedor_id UUID REFERENCES public.fornecedores(id),
  forma_pagamento TEXT,
  numero_parcela INTEGER,
  total_parcelas INTEGER,
  recorrencia TEXT, -- 'mensal', 'semanal', 'quinzenal', 'anual'
  data_fim_recorrencia DATE,
  juros NUMERIC,
  multas NUMERIC,
  desconto NUMERIC,
  taxas_administrativas NUMERIC,
  anexo_url TEXT,
  observacoes TEXT,
  lancado_por UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e tesoureiros podem gerenciar transações" ON public.transacoes_financeiras
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tesoureiro'::app_role));

-- Trigger para atualizar saldo da conta
CREATE OR REPLACE FUNCTION public.atualizar_saldo_conta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual + NEW.valor
      WHERE id = NEW.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual - NEW.valor
      WHERE id = NEW.conta_id;
    END IF;
  ELSIF OLD.status = 'pago' AND NEW.status != 'pago' THEN
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual - OLD.valor
      WHERE id = OLD.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual + OLD.valor
      WHERE id = OLD.conta_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_atualizar_saldo_conta
  AFTER UPDATE ON public.transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_saldo_conta();

-- -----------------------------------------------------
-- Tabela: edge_function_config
-- -----------------------------------------------------
CREATE TABLE public.edge_function_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  schedule_cron TEXT NOT NULL,
  schedule_description TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_execution TIMESTAMP WITH TIME ZONE,
  last_execution_status TEXT,
  execution_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.edge_function_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver configurações" ON public.edge_function_config
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar configurações" ON public.edge_function_config
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sistema pode inserir configurações" ON public.edge_function_config
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- FUNÇÕES DO BANCO DE DADOS
-- =====================================================

-- -----------------------------------------------------
-- Função: has_role
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- -----------------------------------------------------
-- Função: is_member
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id AND status = 'membro'
  )
$$;

-- -----------------------------------------------------
-- Função: get_user_module_access
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_module_access(_user_id uuid, _module_name text)
RETURNS access_level
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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

-- -----------------------------------------------------
-- Função: is_banner_active
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_banner_active(p_active boolean, p_scheduled_at timestamp with time zone, p_expires_at timestamp with time zone)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT p_active THEN
    RETURN false;
  END IF;
  
  IF p_scheduled_at IS NOT NULL AND p_scheduled_at > now() THEN
    RETURN false;
  END IF;
  
  IF p_expires_at IS NOT NULL AND p_expires_at < now() THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- -----------------------------------------------------
-- Função: is_midia_active
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_midia_active(p_ativo boolean, p_scheduled_at timestamp with time zone, p_expires_at timestamp with time zone)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT p_ativo THEN
    RETURN false;
  END IF;
  
  IF p_scheduled_at IS NOT NULL AND p_scheduled_at > now() THEN
    RETURN false;
  END IF;
  
  IF p_expires_at IS NOT NULL AND p_expires_at < now() THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- -----------------------------------------------------
-- Função: update_updated_at_column
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------
-- Função: notify_admins
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_admins(p_title text, p_message text, p_type text, p_related_user_id uuid DEFAULT NULL, p_metadata jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, related_user_id, metadata)
  SELECT 
    ur.user_id,
    p_title,
    p_message,
    p_type,
    p_related_user_id,
    p_metadata
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
END;
$$;

-- -----------------------------------------------------
-- Função: notify_new_visitor
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_visitor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'visitante' THEN
    PERFORM public.notify_admins(
      'Novo Visitante',
      format('Novo visitante cadastrado: %s', NEW.nome),
      'novo_visitante',
      NEW.user_id,
      jsonb_build_object('nome', NEW.nome, 'email', NEW.email)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------
-- Função: notify_status_promotion
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_status_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_message TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'frequentador' THEN
      v_message := format('%s foi promovido a Frequentador', NEW.nome);
    ELSIF NEW.status = 'membro' THEN
      v_message := format('%s foi promovido a Membro', NEW.nome);
    ELSE
      v_message := format('Status de %s foi alterado para %s', NEW.nome, NEW.status);
    END IF;
    
    PERFORM public.notify_admins(
      'Promoção de Status',
      v_message,
      'promocao_status',
      NEW.user_id,
      jsonb_build_object(
        'nome', NEW.nome,
        'email', NEW.email,
        'status_anterior', OLD.status,
        'status_novo', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------
-- Função: notify_new_pedido_oracao
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_pedido_oracao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_solicitante_nome TEXT;
  v_display_nome TEXT;
BEGIN
  IF NEW.pessoa_id IS NOT NULL THEN
    SELECT nome INTO v_solicitante_nome
    FROM public.profiles
    WHERE id = NEW.pessoa_id;
  ELSIF NEW.nome_solicitante IS NOT NULL THEN
    v_solicitante_nome := NEW.nome_solicitante;
  END IF;
  
  IF NEW.anonimo = true THEN
    v_display_nome := 'Anônimo';
  ELSE
    v_display_nome := COALESCE(v_solicitante_nome, 'solicitante desconhecido');
  END IF;
  
  PERFORM public.notify_admins(
    'Novo Pedido de Oração',
    format('Novo pedido de oração recebido de %s (Tipo: %s)', v_display_nome, NEW.tipo),
    'novo_pedido_oracao',
    CASE WHEN NEW.anonimo = true THEN NULL ELSE (SELECT user_id FROM public.profiles WHERE id = NEW.pessoa_id) END,
    jsonb_build_object(
      'solicitante_nome', v_display_nome,
      'tipo', NEW.tipo,
      'pedido_id', NEW.id,
      'anonimo', NEW.anonimo
    )
  );
  
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------
-- Função: notify_new_testemunho
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_new_testemunho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_autor_nome TEXT;
  v_display_nome TEXT;
BEGIN
  SELECT nome INTO v_autor_nome
  FROM public.profiles
  WHERE id = NEW.autor_id;
  
  IF NEW.anonimo = true THEN
    v_display_nome := 'Anônimo';
  ELSE
    v_display_nome := COALESCE(v_autor_nome, 'autor desconhecido');
  END IF;
  
  PERFORM public.notify_admins(
    'Novo Testemunho',
    format('Novo testemunho recebido de %s: %s', v_display_nome, NEW.titulo),
    'novo_testemunho',
    CASE WHEN NEW.anonimo = true THEN NULL ELSE (SELECT user_id FROM public.profiles WHERE id = NEW.autor_id) END,
    jsonb_build_object(
      'autor_nome', v_display_nome,
      'titulo', NEW.titulo,
      'categoria', NEW.categoria,
      'testemunho_id', NEW.id,
      'anonimo', NEW.anonimo
    )
  );
  
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------
-- Função: notify_role_assignment
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  SELECT nome INTO v_user_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  
  PERFORM public.notify_admins(
    'Novo Cargo Atribuído',
    format('Cargo "%s" foi atribuído a %s', NEW.role, COALESCE(v_user_name, 'usuário')),
    'atribuicao_cargo',
    NEW.user_id,
    jsonb_build_object(
      'nome', v_user_name,
      'cargo', NEW.role
    )
  );
  
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------
-- Função: notify_role_removal
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_role_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  SELECT nome INTO v_user_name
  FROM public.profiles
  WHERE user_id = OLD.user_id;
  
  PERFORM public.notify_admins(
    'Cargo Removido',
    format('Cargo "%s" foi removido de %s', OLD.role, COALESCE(v_user_name, 'usuário')),
    'atribuicao_cargo',
    OLD.user_id,
    jsonb_build_object(
      'nome', v_user_name,
      'cargo', OLD.role,
      'acao', 'removido'
    )
  );
  
  RETURN OLD;
END;
$$;

-- -----------------------------------------------------
-- Função: buscar_pessoa_por_contato
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.buscar_pessoa_por_contato(p_nome text DEFAULT NULL, p_email text DEFAULT NULL, p_telefone text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pessoa_id uuid;
BEGIN
  IF p_email IS NOT NULL THEN
    SELECT id INTO v_pessoa_id
    FROM public.profiles
    WHERE LOWER(email) = LOWER(p_email)
    LIMIT 1;
    
    IF v_pessoa_id IS NOT NULL THEN
      RETURN v_pessoa_id;
    END IF;
  END IF;
  
  IF p_telefone IS NOT NULL THEN
    SELECT id INTO v_pessoa_id
    FROM public.profiles
    WHERE REGEXP_REPLACE(telefone, '[^0-9]', '', 'g') = REGEXP_REPLACE(p_telefone, '[^0-9]', '', 'g')
    LIMIT 1;
    
    IF v_pessoa_id IS NOT NULL THEN
      RETURN v_pessoa_id;
    END IF;
  END IF;
  
  IF p_nome IS NOT NULL THEN
    SELECT id INTO v_pessoa_id
    FROM public.profiles
    WHERE LOWER(nome) = LOWER(p_nome)
    LIMIT 1;
    
    IF v_pessoa_id IS NOT NULL THEN
      RETURN v_pessoa_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$;

-- -----------------------------------------------------
-- Função: alocar_pedido_balanceado
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.alocar_pedido_balanceado(p_pedido_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_intercessor_id UUID;
BEGIN
  SELECT i.id INTO v_intercessor_id
  FROM public.intercessores i
  LEFT JOIN (
    SELECT intercessor_id, COUNT(*) as total_pedidos
    FROM public.pedidos_oracao
    WHERE status IN ('pendente', 'em_oracao')
    GROUP BY intercessor_id
  ) p ON i.id = p.intercessor_id
  WHERE i.ativo = true
    AND (p.total_pedidos IS NULL OR p.total_pedidos < i.max_pedidos)
  ORDER BY COALESCE(p.total_pedidos, 0) ASC, i.created_at ASC
  LIMIT 1;
  
  IF v_intercessor_id IS NOT NULL THEN
    UPDATE public.pedidos_oracao
    SET 
      intercessor_id = v_intercessor_id,
      status = 'em_oracao',
      data_alocacao = now()
    WHERE id = p_pedido_id;
  END IF;
  
  RETURN v_intercessor_id;
END;
$$;

-- -----------------------------------------------------
-- Função: atualizar_saldo_conta
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.atualizar_saldo_conta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual + NEW.valor
      WHERE id = NEW.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual - NEW.valor
      WHERE id = NEW.conta_id;
    END IF;
  ELSIF OLD.status = 'pago' AND NEW.status != 'pago' THEN
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual - OLD.valor
      WHERE id = OLD.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual + OLD.valor
      WHERE id = OLD.conta_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------
-- Função: log_edge_function_execution
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_edge_function_execution(p_function_name text, p_status text, p_details text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.edge_function_config
  SET 
    last_execution = now(),
    last_execution_status = p_status,
    execution_count = execution_count + 1,
    updated_at = now()
  WHERE function_name = p_function_name;
END;
$$;

-- -----------------------------------------------------
-- Função: mask_cpf_cnpj
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.mask_cpf_cnpj(cpf_cnpj text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF cpf_cnpj IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN SUBSTRING(cpf_cnpj FROM 1 FOR 3) || '***' || 
         SUBSTRING(cpf_cnpj FROM LENGTH(cpf_cnpj) - 1 FOR 2);
END;
$$;

-- -----------------------------------------------------
-- Função: log_profile_access (placeholder)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_profile_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- =====================================================
-- STORAGE BUCKETS
-- =====================================================

-- Banner Images (público)
INSERT INTO storage.buckets (id, name, public) VALUES ('banner-images', 'banner-images', true);

-- Transações Anexos (privado)
INSERT INTO storage.buckets (id, name, public) VALUES ('transacoes-anexos', 'transacoes-anexos', false);

-- Igreja Logo (público)
INSERT INTO storage.buckets (id, name, public) VALUES ('igreja-logo', 'igreja-logo', true);

-- Mídias (público)
INSERT INTO storage.buckets (id, name, public) VALUES ('midias', 'midias', true);

-- Avatars (público)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- =====================================================
-- FIM DO SCHEMA
-- =====================================================

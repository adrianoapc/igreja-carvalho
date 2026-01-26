-- =============================================================================
-- SCHEMA COMPLETO DO BANCO DE DADOS - IGREJA APP
-- Gerado em: 2026-01-26
-- Total de Tabelas: 113
-- =============================================================================

-- =============================================================================
-- ENUMS (Tipos Personalizados)
-- =============================================================================

-- Status de sessão do chatbot
CREATE TYPE status_sessao_chat AS ENUM (
  'INICIADO',
  'AGUARDANDO_NOME',
  'AGUARDANDO_MOTIVO',
  'FINALIZADO',
  'TRANSFERIDO'
);

-- Status de atendimento pastoral
CREATE TYPE status_atendimento_enum AS ENUM (
  'PENDENTE',
  'AGUARDANDO',
  'EM_ANDAMENTO',
  'CONCLUIDO',
  'CANCELADO'
);

-- Gravidade de atendimento
CREATE TYPE gravidade_enum AS ENUM (
  'BAIXA',
  'MEDIA',
  'ALTA',
  'URGENTE'
);

-- Tipo de comunicado
CREATE TYPE tipo_comunicado AS ENUM (
  'alerta',
  'informativo',
  'convite',
  'devocional'
);

-- Status de usuário
CREATE TYPE user_status AS ENUM (
  'visitante',
  'frequentador',
  'membro',
  'inativo'
);

-- Tipo de pedido de oração
CREATE TYPE tipo_pedido AS ENUM (
  'saude',
  'familia',
  'financeiro',
  'espiritual',
  'trabalho',
  'relacionamento',
  'outro'
);

-- Status de pedido de oração
CREATE TYPE status_pedido AS ENUM (
  'pendente',
  'em_oracao',
  'respondido',
  'cancelado'
);

-- Status de intercessor
CREATE TYPE status_intercessor AS ENUM (
  'ATIVO',
  'AUSENTE',
  'INATIVO'
);

-- Categoria de testemunho
CREATE TYPE categoria_testemunho AS ENUM (
  'cura',
  'financeiro',
  'familiar',
  'profissional',
  'espiritual',
  'outro'
);

-- Status de testemunho
CREATE TYPE status_testemunho AS ENUM (
  'aberto',
  'aprovado',
  'rejeitado'
);

-- Tipo de sentimento
CREATE TYPE sentimento_tipo AS ENUM (
  'muito_feliz',
  'feliz',
  'neutro',
  'triste',
  'muito_triste'
);

-- Tipo de evento
CREATE TYPE evento_tipo AS ENUM (
  'culto',
  'celebracao',
  'reuniao',
  'conferencia',
  'retiro',
  'curso',
  'outro'
);

-- Roles de aplicação
CREATE TYPE app_role AS ENUM (
  'admin',
  'pastor',
  'lider',
  'secretario',
  'tesoureiro',
  'membro',
  'visitante'
);

-- Níveis de acesso
CREATE TYPE access_level AS ENUM (
  'none',
  'view',
  'edit',
  'full'
);

-- =============================================================================
-- FUNÇÕES AUXILIARES
-- =============================================================================

-- Função para obter filial do usuário atual
CREATE OR REPLACE FUNCTION get_current_user_filial_id()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT filial_id 
    FROM profiles 
    WHERE user_id = auth.uid() 
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TABELAS PRINCIPAIS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Configuração e Sistema
-- -----------------------------------------------------------------------------

CREATE TABLE igrejas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  cnpj text,
  email text,
  telefone text,
  endereco text,
  cidade text,
  estado text,
  cep text,
  logo_url text,
  status text NOT NULL DEFAULT 'ativo'::text,
  aprovado_por uuid,
  aprovado_em timestamp with time zone,
  admin_responsavel_id uuid,
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE filiais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  nome text NOT NULL,
  is_sede boolean DEFAULT false,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE app_config (
  id integer NOT NULL DEFAULT 1 PRIMARY KEY,
  maintenance_mode boolean DEFAULT false,
  maintenance_message text DEFAULT 'O sistema está em manutenção programada. Voltamos em breve.'::text,
  allow_public_access boolean DEFAULT true,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE configuracoes_igreja (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id uuid REFERENCES igrejas(id),
  nome_igreja text NOT NULL DEFAULT 'Igreja App'::text,
  subtitulo text DEFAULT 'Gestão Completa'::text,
  logo_url text,
  telefone_plantao_pastoral text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Autenticação e Permissões
-- -----------------------------------------------------------------------------

CREATE TABLE app_roles (
  id bigint NOT NULL PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_system boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE app_permissions (
  id bigint NOT NULL PRIMARY KEY,
  key text NOT NULL,
  name text NOT NULL,
  module text NOT NULL,
  description text
);

CREATE TABLE role_permissions (
  role_id bigint NOT NULL REFERENCES app_roles(id),
  permission_id bigint NOT NULL REFERENCES app_permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE role_permissions_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL,
  role_id bigint NOT NULL,
  permission_id bigint NOT NULL,
  old_row jsonb,
  new_row jsonb,
  source text,
  request_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE user_app_roles (
  user_id uuid NOT NULL,
  role_id bigint NOT NULL REFERENCES app_roles(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  igreja_id uuid REFERENCES igrejas(id)
);

CREATE TABLE user_filial_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  filial_id uuid NOT NULL REFERENCES filiais(id),
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  granted_by uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE module_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role NOT NULL,
  module_name text NOT NULL,
  access_level access_level NOT NULL
);

-- -----------------------------------------------------------------------------
-- Pessoas e Perfis
-- -----------------------------------------------------------------------------

CREATE TABLE profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  nome text NOT NULL,
  email text,
  telefone text,
  status user_status NOT NULL DEFAULT 'visitante'::user_status,
  sexo text,
  data_nascimento date,
  estado_civil text,
  data_casamento date,
  rg text,
  cpf text,
  necessidades_especiais text,
  cep text,
  cidade text,
  bairro text,
  estado text,
  endereco text,
  nacionalidade text,
  naturalidade text,
  escolaridade text,
  profissao text,
  tipo_sanguineo text,
  alergias text,
  avatar_url text,
  
  -- Dados da igreja
  data_primeira_visita timestamp with time zone DEFAULT now(),
  data_cadastro_membro timestamp with time zone,
  data_ultima_visita timestamp with time zone,
  numero_visitas integer NOT NULL DEFAULT 1,
  aceitou_jesus boolean DEFAULT false,
  deseja_contato boolean DEFAULT true,
  recebeu_brinde boolean DEFAULT false,
  entrou_por text,
  data_entrada date,
  status_igreja text DEFAULT 'ativo'::text,
  data_conversao date,
  batizado boolean DEFAULT false,
  data_batismo date,
  e_lider boolean DEFAULT false,
  e_pastor boolean DEFAULT false,
  entrevistado_por text,
  cadastrado_por text,
  
  -- Relacionamentos
  familia_id uuid,
  responsavel_legal boolean DEFAULT false,
  
  -- Configurações
  disponibilidade_agenda jsonb DEFAULT '{"padrao": true}'::jsonb,
  autorizado_bot_financeiro boolean DEFAULT false,
  deve_trocar_senha boolean DEFAULT false,
  
  -- Multi-tenant
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  
  observacoes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE familias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id uuid NOT NULL REFERENCES profiles(id),
  familiar_id uuid REFERENCES profiles(id),
  nome_familiar text,
  tipo_parentesco text NOT NULL,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE alteracoes_perfil_pendentes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id),
  dados_novos jsonb NOT NULL,
  dados_antigos jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pendente'::text,
  aprovado_por uuid,
  campos_aprovados jsonb DEFAULT '{}'::jsonb,
  observacoes text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE funcoes_igreja (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE membro_funcoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  membro_id uuid NOT NULL REFERENCES profiles(id),
  funcao_id uuid NOT NULL REFERENCES funcoes_igreja(id),
  data_inicio date DEFAULT CURRENT_DATE,
  data_fim date,
  ativo boolean DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Visitantes e Leads (CRM)
-- -----------------------------------------------------------------------------

CREATE TABLE visitantes_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome character varying(255),
  telefone character varying(20) NOT NULL,
  email character varying(255),
  origem character varying(50) DEFAULT 'WABA'::character varying,
  estagio_funil character varying(50) DEFAULT 'NOVO'::character varying,
  observacoes text,
  data_ultimo_contato timestamp with time zone,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE visitante_contatos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitante_id uuid NOT NULL REFERENCES visitantes_leads(id),
  data_contato timestamp with time zone NOT NULL,
  membro_responsavel_id uuid NOT NULL REFERENCES profiles(id),
  tipo_contato text DEFAULT 'telefonico'::text,
  status text DEFAULT 'agendado'::text,
  observacoes text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Eventos
-- -----------------------------------------------------------------------------

CREATE TABLE evento_subtipos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  tipo_pai evento_tipo NOT NULL,
  cor text,
  ativo boolean DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL,
  subtipo_id uuid REFERENCES evento_subtipos(id),
  titulo text NOT NULL,
  descricao text,
  data_evento timestamp with time zone NOT NULL,
  duracao_minutos integer,
  local text,
  endereco text,
  pregador text,
  tema text,
  exibir_preletor boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'planejado'::text,
  
  -- Inscrições
  requer_inscricao boolean DEFAULT false,
  requer_pagamento boolean DEFAULT false,
  valor_inscricao numeric DEFAULT 0.00,
  vagas_limite integer,
  inscricoes_abertas_ate timestamp with time zone,
  mostrar_posicao_fila boolean DEFAULT false,
  
  -- Financeiro
  categoria_financeira_id uuid,
  conta_financeira_id uuid,
  
  -- Check-in
  exigir_documento_checkin boolean DEFAULT false,
  
  -- Multi-tenant
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  
  observacoes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE evento_lotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id uuid NOT NULL REFERENCES eventos(id),
  nome text NOT NULL,
  descricao text,
  valor numeric NOT NULL DEFAULT 0.00,
  vigencia_inicio timestamp with time zone,
  vigencia_fim timestamp with time zone,
  vagas_limite integer,
  vagas_utilizadas integer DEFAULT 0,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE inscricoes_eventos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id uuid NOT NULL REFERENCES eventos(id),
  pessoa_id uuid NOT NULL REFERENCES profiles(id),
  responsavel_inscricao_id uuid REFERENCES profiles(id),
  lote_id uuid REFERENCES evento_lotes(id),
  status_pagamento text NOT NULL DEFAULT 'isento'::text,
  valor_pago numeric DEFAULT 0.00,
  transacao_id uuid,
  qr_token uuid DEFAULT gen_random_uuid(),
  checkin_validado_em timestamp with time zone,
  checkin_validado_por uuid,
  lembrete_pagamento_em timestamp with time zone,
  cancelado_em timestamp with time zone,
  observacoes text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE evento_lista_espera (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id uuid NOT NULL REFERENCES eventos(id),
  nome character varying(255) NOT NULL,
  telefone character varying(50) NOT NULL,
  email character varying(255),
  pessoa_id uuid REFERENCES profiles(id),
  visitante_lead_id uuid REFERENCES visitantes_leads(id),
  posicao_fila integer NOT NULL DEFAULT 1,
  status character varying(20) DEFAULT 'aguardando'::character varying,
  contatado_em timestamp with time zone,
  observacoes text,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE eventos_convites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id uuid NOT NULL REFERENCES eventos(id),
  pessoa_id uuid NOT NULL REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pendente'::text,
  motivo_recusa text,
  visualizado_em timestamp with time zone,
  enviado_em timestamp with time zone,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Check-ins
CREATE TABLE checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id uuid NOT NULL REFERENCES eventos(id),
  pessoa_id uuid NOT NULL REFERENCES profiles(id),
  metodo text,
  validado_por uuid,
  tipo_registro text DEFAULT 'manual'::text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Liturgia e Cultos
-- -----------------------------------------------------------------------------

CREATE TABLE templates_culto (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  tipo_culto text,
  categoria text DEFAULT 'Geral'::text,
  tema_padrao text,
  local_padrao text,
  duracao_padrao integer,
  pregador_padrao text,
  observacoes_padrao text,
  incluir_escalas boolean DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE itens_template_culto (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES templates_culto(id),
  ordem integer NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  duracao_minutos integer,
  responsavel_externo text,
  midias_ids uuid[],
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE liturgia_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  estrutura_json jsonb,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE liturgias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id uuid NOT NULL REFERENCES eventos(id),
  tipo text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  duracao_minutos integer,
  ordem integer NOT NULL,
  responsavel_id uuid REFERENCES profiles(id),
  responsavel_externo text,
  midias_ids uuid[] DEFAULT '{}'::uuid[],
  permite_multiplo boolean NOT NULL DEFAULT false,
  tipo_conteudo text NOT NULL DEFAULT 'ATO_PRESENCIAL'::text,
  conteudo_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  bloqueio_progresso boolean NOT NULL DEFAULT false,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE liturgia_recursos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  liturgia_item_id uuid NOT NULL REFERENCES liturgias(id),
  midia_id uuid NOT NULL,
  ordem integer DEFAULT 0,
  duracao_segundos integer DEFAULT 10,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE cancoes_culto (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id uuid NOT NULL REFERENCES eventos(id),
  titulo text NOT NULL,
  artista text,
  tom text,
  bpm integer,
  duracao_minutos integer,
  letra text,
  cifra text,
  link_youtube text,
  link_spotify text,
  ordem integer NOT NULL,
  solista_id uuid REFERENCES profiles(id),
  ministro_id uuid REFERENCES profiles(id),
  observacoes text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Times e Escalas
-- -----------------------------------------------------------------------------

CREATE TABLE categorias_times (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#8B5CF6'::text,
  ativo boolean NOT NULL DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE times (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  categoria text NOT NULL,
  descricao text,
  cor text,
  lider_id uuid REFERENCES profiles(id),
  sublider_id uuid REFERENCES profiles(id),
  vagas_necessarias integer DEFAULT 1,
  dificuldade text DEFAULT 'médio'::text,
  ativo boolean NOT NULL DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE posicoes_time (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_id uuid NOT NULL REFERENCES times(id),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE membros_time (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_id uuid NOT NULL REFERENCES times(id),
  pessoa_id uuid NOT NULL REFERENCES profiles(id),
  posicao_id uuid REFERENCES posicoes_time(id),
  data_entrada date,
  ativo boolean NOT NULL DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE escalas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id uuid NOT NULL REFERENCES eventos(id),
  time_id uuid REFERENCES times(id),
  pessoa_id uuid NOT NULL REFERENCES profiles(id),
  posicao_id uuid REFERENCES posicoes_time(id),
  data_hora_inicio timestamp with time zone,
  data_hora_fim timestamp with time zone,
  confirmado boolean NOT NULL DEFAULT false,
  status_confirmacao text DEFAULT 'pendente'::text,
  data_confirmacao timestamp with time zone,
  motivo_recusa text,
  checkin_realizado boolean DEFAULT false,
  ultimo_aviso_em timestamp with time zone,
  observacoes text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE escalas_template (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES templates_culto(id),
  time_id uuid NOT NULL REFERENCES times(id),
  posicao_id uuid REFERENCES posicoes_time(id),
  pessoa_id uuid REFERENCES profiles(id),
  observacoes text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Voluntariado
CREATE TABLE candidatos_voluntario (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id uuid REFERENCES profiles(id),
  nome_contato text NOT NULL,
  telefone_contato text,
  email_contato text,
  ministerio text NOT NULL,
  disponibilidade text NOT NULL,
  experiencia text NOT NULL,
  trilha_requerida_id uuid,
  status text NOT NULL DEFAULT 'pendente'::text,
  avaliado_por uuid REFERENCES profiles(id),
  data_avaliacao timestamp with time zone,
  observacoes text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE candidatos_voluntario_historico (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidato_id uuid NOT NULL REFERENCES candidatos_voluntario(id),
  acao text NOT NULL,
  status_anterior text,
  status_novo text,
  observacoes text,
  realizado_por uuid REFERENCES profiles(id),
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Ensino e Jornadas
-- -----------------------------------------------------------------------------

CREATE TABLE jornadas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  cor_tema text DEFAULT '#3b82f6'::text,
  tipo_jornada text DEFAULT 'auto_instrucional'::text,
  exibir_portal boolean DEFAULT true,
  requer_pagamento boolean DEFAULT false,
  valor numeric DEFAULT 0.00,
  ativo boolean DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE etapas_jornada (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jornada_id uuid NOT NULL REFERENCES jornadas(id),
  titulo text NOT NULL,
  ordem integer NOT NULL,
  tipo_conteudo text DEFAULT 'check'::text,
  conteudo_tipo text DEFAULT 'texto'::text,
  conteudo_url text,
  conteudo_texto text,
  aula_vinculada_id uuid,
  quiz_config jsonb,
  check_automatico boolean DEFAULT false,
  duracao_estimada_minutos integer,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE inscricoes_jornada (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jornada_id uuid NOT NULL REFERENCES jornadas(id),
  pessoa_id uuid NOT NULL REFERENCES profiles(id),
  etapa_atual_id uuid REFERENCES etapas_jornada(id),
  responsavel_id uuid REFERENCES profiles(id),
  data_entrada timestamp with time zone DEFAULT now(),
  data_mudanca_fase timestamp with time zone DEFAULT now(),
  concluido boolean DEFAULT false,
  status_pagamento text DEFAULT 'isento'::text,
  transacao_id uuid,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE respostas_quiz (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inscricao_id uuid REFERENCES inscricoes_jornada(id),
  etapa_id uuid REFERENCES etapas_jornada(id),
  respostas jsonb NOT NULL,
  nota_obtida numeric,
  aprovado boolean DEFAULT false,
  tentativa_numero integer DEFAULT 1,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE salas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  capacidade integer DEFAULT 20,
  idade_min integer,
  idade_max integer,
  tipo text DEFAULT 'kids'::text,
  ativo boolean DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE aulas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sala_id uuid REFERENCES salas(id),
  jornada_id uuid REFERENCES jornadas(id),
  evento_id uuid REFERENCES eventos(id),
  tema text,
  professor_id uuid REFERENCES profiles(id),
  data_inicio timestamp with time zone NOT NULL,
  duracao_minutos integer DEFAULT 60,
  modalidade text DEFAULT 'presencial'::text,
  link_reuniao text,
  status text DEFAULT 'agendada'::text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE presencas_aula (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aula_id uuid REFERENCES aulas(id),
  etapa_id uuid REFERENCES etapas_jornada(id),
  aluno_id uuid REFERENCES profiles(id),
  checkin_at timestamp with time zone DEFAULT now(),
  checkout_at timestamp with time zone,
  responsavel_checkout_id uuid REFERENCES profiles(id),
  status text DEFAULT 'presente'::text,
  attendance_mode text,
  observacoes_seguranca text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Ministério Kids
-- -----------------------------------------------------------------------------

CREATE TABLE kids_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crianca_id uuid NOT NULL REFERENCES profiles(id),
  responsavel_id uuid NOT NULL REFERENCES profiles(id),
  evento_id uuid REFERENCES eventos(id),
  checkin_at timestamp with time zone DEFAULT now(),
  checkout_at timestamp with time zone,
  checkin_por uuid REFERENCES profiles(id),
  checkout_por uuid REFERENCES profiles(id),
  observacoes text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE kids_diario (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crianca_id uuid NOT NULL REFERENCES profiles(id),
  culto_id uuid REFERENCES eventos(id),
  data date NOT NULL DEFAULT CURRENT_DATE,
  professor_id uuid NOT NULL REFERENCES profiles(id),
  comportamento_tags text[] DEFAULT '{}'::text[],
  necessidades_tags text[] DEFAULT '{}'::text[],
  humor text,
  observacoes text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Intercessão e Oração
-- -----------------------------------------------------------------------------

CREATE TABLE intercessores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  nome text NOT NULL,
  email text,
  telefone text,
  status_disponibilidade status_intercessor DEFAULT 'ATIVO'::status_intercessor,
  max_pedidos integer DEFAULT 10,
  ativo boolean DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE pedidos_oracao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo tipo_pedido NOT NULL DEFAULT 'outro'::tipo_pedido,
  status status_pedido NOT NULL DEFAULT 'pendente'::status_pedido,
  anonimo boolean DEFAULT false,
  membro_id uuid REFERENCES profiles(id),
  intercessor_id uuid REFERENCES intercessores(id),
  nome_solicitante text,
  email_solicitante text,
  telefone_solicitante text,
  pedido text NOT NULL,
  observacoes_intercessor text,
  data_criacao timestamp with time zone DEFAULT now(),
  data_alocacao timestamp with time zone,
  data_resposta timestamp with time zone,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE testemunhos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  categoria categoria_testemunho NOT NULL DEFAULT 'outro'::categoria_testemunho,
  status status_testemunho NOT NULL DEFAULT 'aberto'::status_testemunho,
  autor_id uuid REFERENCES profiles(id),
  pessoa_id uuid REFERENCES profiles(id),
  anonimo boolean DEFAULT false,
  nome_externo text,
  email_externo text,
  telefone_externo text,
  publicar boolean NOT NULL DEFAULT false,
  data_publicacao timestamp with time zone,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE sentimentos_membros (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id uuid NOT NULL REFERENCES profiles(id),
  sentimento sentimento_tipo NOT NULL,
  mensagem text,
  data_registro timestamp with time zone NOT NULL DEFAULT now(),
  analise_ia_titulo text,
  analise_ia_motivo text,
  analise_ia_gravidade text,
  analise_ia_resposta text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Gabinete Pastoral
-- -----------------------------------------------------------------------------

CREATE TABLE agenda_pastoral (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pastor_id uuid NOT NULL REFERENCES profiles(id),
  titulo text NOT NULL,
  descricao text,
  data_inicio timestamp with time zone NOT NULL,
  data_fim timestamp with time zone NOT NULL,
  tipo character varying DEFAULT 'COMPROMISSO'::character varying,
  cor character varying DEFAULT 'blue'::character varying,
  criado_por uuid REFERENCES profiles(id),
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE atendimentos_pastorais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id uuid REFERENCES profiles(id),
  visitante_id uuid REFERENCES visitantes_leads(id),
  sessao_bot_id uuid,
  origem text DEFAULT 'CHATBOT'::text,
  motivo_resumo text,
  conteudo_original text,
  gravidade gravidade_enum DEFAULT 'BAIXA'::gravidade_enum,
  pastor_responsavel_id uuid REFERENCES profiles(id),
  status status_atendimento_enum DEFAULT 'PENDENTE'::status_atendimento_enum,
  data_agendamento timestamp with time zone,
  local_atendimento text,
  observacoes_internas text,
  historico_evolucao jsonb DEFAULT '[]'::jsonb,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Chatbot e Atendimentos
-- -----------------------------------------------------------------------------

CREATE TABLE chatbot_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  edge_function_name text NOT NULL,
  ativo boolean DEFAULT true,
  modelo_texto text DEFAULT 'gpt-4o-mini'::text,
  modelo_audio text DEFAULT 'whisper-1'::text,
  modelo_visao text DEFAULT 'gpt-4o'::text,
  role_texto text,
  role_audio text DEFAULT 'Transcreva o áudio fielmente, mantendo o contexto e a intenção do falante.'::text,
  role_visao text DEFAULT 'Analise a imagem e extraia informações relevantes como texto, dados ou elementos visuais.'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE atendimentos_bot (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telefone character varying(20) NOT NULL,
  status status_sessao_chat DEFAULT 'INICIADO'::status_sessao_chat,
  origem_canal text DEFAULT 'whatsapp_oracao'::text,
  historico_conversa jsonb DEFAULT '[]'::jsonb,
  meta_dados jsonb DEFAULT '{}'::jsonb,
  pessoa_id uuid REFERENCES profiles(id),
  visitante_id uuid REFERENCES visitantes_leads(id),
  ultima_mensagem_at timestamp with time zone DEFAULT now(),
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE logs_auditoria_chat (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sessao_id uuid REFERENCES atendimentos_bot(id),
  ator character varying(20) NOT NULL,
  tipo_evento character varying(50),
  payload_raw jsonb NOT NULL,
  ip_origem character varying(45),
  timestamp_exato timestamp with time zone DEFAULT now(),
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id()
);

-- -----------------------------------------------------------------------------
-- Financeiro
-- -----------------------------------------------------------------------------

CREATE TABLE bases_ministeriais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  responsavel_id uuid REFERENCES profiles(id),
  ativo boolean NOT NULL DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE centros_custo (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  descricao text,
  base_ministerial_id uuid REFERENCES bases_ministeriais(id),
  ativo boolean NOT NULL DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE categorias_financeiras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL,
  secao_dre text,
  cor text,
  ativo boolean NOT NULL DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE subcategorias_financeiras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  categoria_id uuid NOT NULL REFERENCES categorias_financeiras(id),
  ativo boolean NOT NULL DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE contas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL,
  saldo_inicial numeric NOT NULL DEFAULT 0,
  saldo_atual numeric NOT NULL DEFAULT 0,
  banco text,
  agencia text,
  conta_numero text,
  cnpj_banco text,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE formas_pagamento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  is_digital boolean NOT NULL DEFAULT false,
  taxa_administrativa numeric DEFAULT 0,
  taxa_administrativa_fixa numeric,
  gera_pago boolean DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE forma_pagamento_contas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  forma_pagamento_id uuid NOT NULL REFERENCES formas_pagamento(id),
  conta_id uuid NOT NULL REFERENCES contas(id),
  prioridade integer DEFAULT 1,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid,
  criado_em timestamp with time zone DEFAULT now()
);

CREATE TABLE fornecedores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  tipo_pessoa text NOT NULL,
  cpf_cnpj text,
  email text,
  telefone text,
  endereco text,
  cidade text,
  estado text,
  cep text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE transacoes_financeiras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL,
  tipo_lancamento text NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  data_vencimento date NOT NULL,
  data_pagamento date,
  data_competencia date,
  status text NOT NULL DEFAULT 'pendente'::text,
  conta_id uuid NOT NULL REFERENCES contas(id),
  categoria_id uuid REFERENCES categorias_financeiras(id),
  subcategoria_id uuid REFERENCES subcategorias_financeiras(id),
  centro_custo_id uuid REFERENCES centros_custo(id),
  base_ministerial_id uuid REFERENCES bases_ministeriais(id),
  fornecedor_id uuid REFERENCES fornecedores(id),
  pessoa_id uuid REFERENCES profiles(id),
  forma_pagamento text,
  numero_parcela integer,
  total_parcelas integer,
  recorrencia text,
  data_fim_recorrencia date,
  juros numeric DEFAULT 0,
  multas numeric DEFAULT 0,
  desconto numeric DEFAULT 0,
  taxas_administrativas numeric DEFAULT 0,
  valor_liquido numeric,
  anexo_url text,
  origem_registro text NOT NULL DEFAULT 'manual'::text,
  sessao_id uuid,
  solicitacao_reembolso_id uuid,
  lancado_por uuid REFERENCES profiles(id),
  observacoes text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE extratos_bancarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_id uuid NOT NULL REFERENCES contas(id),
  data_transacao date NOT NULL,
  descricao text NOT NULL,
  valor numeric NOT NULL,
  saldo numeric,
  numero_documento text,
  tipo text NOT NULL,
  reconciliado boolean DEFAULT false,
  external_id text,
  origem text DEFAULT 'manual'::text,
  import_job_id uuid,
  transacao_vinculada_id uuid REFERENCES transacoes_financeiras(id),
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- Sessões de Contagem (Coleta de Ofertas)
CREATE TABLE sessoes_contagem (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid,
  data_culto date NOT NULL,
  periodo text NOT NULL,
  status text NOT NULL DEFAULT 'aberto'::text,
  blind_count_mode text NOT NULL,
  blind_min_counters integer NOT NULL,
  blind_tolerance_value numeric NOT NULL,
  blind_compare_level text NOT NULL,
  blind_lock_totals boolean NOT NULL,
  provider_tipo text,
  webhook_url text,
  secret_hint text,
  sync_strategy text,
  conferentes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES profiles(id),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamp with time zone,
  variance_value numeric,
  variance_by_tipo jsonb,
  rejection_reason_code text,
  rejection_reason_note text,
  rejection_by uuid,
  rejection_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE contagens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sessao_id uuid NOT NULL REFERENCES sessoes_contagem(id),
  contador_id uuid NOT NULL,
  ordem smallint NOT NULL,
  total numeric NOT NULL DEFAULT 0,
  totais_por_tipo jsonb NOT NULL DEFAULT '{"dizimo": 0, "oferta": 0, "missoes": 0}'::jsonb,
  submitted_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE sessoes_itens_draft (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid,
  sessao_id uuid NOT NULL REFERENCES sessoes_contagem(id),
  is_digital boolean NOT NULL DEFAULT false,
  origem_registro text NOT NULL DEFAULT 'manual'::text,
  pessoa_id uuid REFERENCES profiles(id),
  forma_pagamento_id uuid REFERENCES formas_pagamento(id),
  conta_id uuid REFERENCES contas(id),
  categoria_id uuid REFERENCES categorias_financeiras(id),
  valor numeric NOT NULL DEFAULT 0,
  descricao text,
  read_only boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE financeiro_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid,
  integracao_pix_enabled boolean NOT NULL DEFAULT false,
  integracao_gateway_enabled boolean NOT NULL DEFAULT false,
  integracao_banco_enabled boolean NOT NULL DEFAULT false,
  sync_strategy text NOT NULL DEFAULT 'webhook'::text,
  conciliacao_janela_horas integer NOT NULL DEFAULT 24,
  blind_count_mode text NOT NULL DEFAULT 'optional'::text,
  blind_min_counters integer NOT NULL DEFAULT 2,
  blind_tolerance_value numeric NOT NULL DEFAULT 0,
  blind_compare_level text NOT NULL DEFAULT 'total'::text,
  blind_lock_totals boolean NOT NULL DEFAULT true,
  mapping_default_conta_por_forma jsonb NOT NULL DEFAULT '{}'::jsonb,
  periodos text[],
  formas_fisicas_ids text[],
  formas_digitais_ids text[],
  tipos_permitidos_fisico text[],
  tipos_permitidos_digital text[],
  valor_zero_policy text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE integracoes_financeiras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid,
  cnpj text NOT NULL,
  provedor text NOT NULL,
  status text NOT NULL DEFAULT 'ativo'::text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE integracoes_financeiras_secrets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integracao_id uuid NOT NULL REFERENCES integracoes_financeiras(id),
  pfx_blob bytea,
  pfx_password text,
  client_id text,
  client_secret text,
  application_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Reembolsos
CREATE TABLE solicitacoes_reembolso (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitante_id uuid NOT NULL REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'rascunho'::text,
  data_solicitacao date NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento date,
  data_pagamento timestamp with time zone,
  forma_pagamento_preferida text,
  dados_bancarios text,
  valor_total numeric DEFAULT 0,
  comprovante_pagamento_url text,
  observacoes text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE itens_reembolso (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  solicitacao_id uuid NOT NULL REFERENCES solicitacoes_reembolso(id),
  categoria_id uuid REFERENCES categorias_financeiras(id),
  subcategoria_id uuid REFERENCES subcategorias_financeiras(id),
  fornecedor_id uuid REFERENCES fornecedores(id),
  base_ministerial_id uuid REFERENCES bases_ministeriais(id),
  centro_custo_id uuid REFERENCES centros_custo(id),
  descricao text NOT NULL,
  valor numeric NOT NULL,
  data_item date NOT NULL,
  foto_url text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now()
);

-- Importação de Dados
CREATE TABLE import_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid NOT NULL,
  user_id uuid NOT NULL,
  tipo character varying(50) NOT NULL,
  file_name character varying(255) NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  rejected_rows integer NOT NULL DEFAULT 0,
  status character varying(50) NOT NULL DEFAULT 'pending'::character varying,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  undone_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE import_job_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES import_jobs(id),
  transacao_id uuid REFERENCES transacoes_financeiras(id),
  row_index integer NOT NULL,
  status character varying(50) NOT NULL DEFAULT 'pending'::character varying,
  error_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE import_presets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid NOT NULL,
  user_id uuid NOT NULL,
  tipo character varying(50) NOT NULL,
  name character varying(255) NOT NULL,
  description text,
  mapping jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Reclassificação em Lote
CREATE TABLE reclass_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid,
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  filtros_aplicados jsonb,
  campos_alterados jsonb,
  total_linhas integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing'::text,
  error_reason text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE reclass_job_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES reclass_jobs(id),
  transacao_id uuid REFERENCES transacoes_financeiras(id),
  antes jsonb,
  depois jsonb,
  status text NOT NULL DEFAULT 'updated'::text,
  error_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Mídias
-- -----------------------------------------------------------------------------

CREATE TABLE tags_midias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  cor text DEFAULT '#8B5CF6'::text,
  ativo boolean DEFAULT true,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE midias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  culto_id uuid REFERENCES eventos(id),
  titulo text NOT NULL,
  tipo text NOT NULL,
  url text NOT NULL,
  descricao text,
  canal text NOT NULL DEFAULT 'telao'::text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  scheduled_at timestamp with time zone,
  expires_at timestamp with time zone,
  tags text[],
  created_by uuid REFERENCES profiles(id),
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE midia_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  midia_id uuid NOT NULL REFERENCES midias(id),
  tag_id uuid NOT NULL REFERENCES tags_midias(id),
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Comunicação
-- -----------------------------------------------------------------------------

CREATE TABLE comunicados (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  imagem_url text,
  tipo tipo_comunicado NOT NULL DEFAULT 'alerta'::tipo_comunicado,
  nivel_urgencia text DEFAULT 'info'::text,
  link_acao text,
  ativo boolean DEFAULT true,
  data_inicio timestamp with time zone DEFAULT now(),
  data_fim timestamp with time zone,
  exibir_app boolean DEFAULT true,
  exibir_telao boolean DEFAULT false,
  exibir_site boolean DEFAULT false,
  url_arquivo_telao text,
  ordem_telao integer DEFAULT 0,
  categoria_midia text DEFAULT 'geral'::text,
  tags text[] DEFAULT '{}'::text[],
  evento_id uuid REFERENCES eventos(id),
  midia_id uuid REFERENCES midias(id),
  created_by uuid REFERENCES profiles(id),
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE banners (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info'::text,
  image_url text,
  active boolean DEFAULT true,
  scheduled_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_by uuid REFERENCES profiles(id),
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  read boolean DEFAULT false,
  related_user_id uuid,
  metadata jsonb,
  rejected_at timestamp with time zone,
  rejected_by uuid,
  rejection_reason text,
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE notificacao_eventos (
  slug text NOT NULL PRIMARY KEY,
  nome text NOT NULL,
  categoria text NOT NULL,
  provider_preferencial text DEFAULT 'make'::text,
  template_meta text,
  variaveis text[],
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE notificacao_regras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_slug text REFERENCES notificacao_eventos(slug),
  role_alvo text,
  user_id_especifico uuid,
  canais jsonb DEFAULT '{"push": false, "in_app": true, "whatsapp": false}'::jsonb,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Projetos e Tarefas
-- -----------------------------------------------------------------------------

CREATE TABLE projetos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'ativo'::text,
  data_inicio date,
  data_fim date,
  lider_id uuid REFERENCES profiles(id),
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE tarefas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id uuid NOT NULL REFERENCES projetos(id),
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'todo'::text,
  prioridade text DEFAULT 'media'::text,
  data_vencimento date,
  responsavel_id uuid REFERENCES profiles(id),
  criado_por uuid REFERENCES profiles(id),
  igreja_id uuid REFERENCES igrejas(id),
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Webhooks e Integrações
-- -----------------------------------------------------------------------------

CREATE TABLE webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  tipo text NOT NULL,
  url text,
  secret text,
  secret_encrypted bytea,
  secret_hint text,
  enabled boolean NOT NULL DEFAULT true,
  filial_id uuid DEFAULT get_current_user_filial_id(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE whatsapp_numeros (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid,
  phone_number_id text,
  display_phone_number text,
  provider text NOT NULL DEFAULT 'meta'::text,
  tipo character varying(20) DEFAULT 'PUBLICO'::character varying,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE short_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  target_url text NOT NULL,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_id uuid,
  is_all_filiais boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- Edge Functions e Logs
-- -----------------------------------------------------------------------------

CREATE TABLE edge_function_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  schedule_cron text NOT NULL,
  schedule_description text NOT NULL,
  last_execution timestamp with time zone,
  last_execution_status text,
  execution_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE edge_function_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name text NOT NULL,
  execution_time_ms integer,
  status text NOT NULL,
  error_message text,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Segurança e Auditoria
-- -----------------------------------------------------------------------------

CREATE TABLE blocked_ips (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text NOT NULL,
  reason text NOT NULL,
  blocked_at timestamp with time zone DEFAULT now(),
  blocked_until timestamp with time zone,
  violation_count integer DEFAULT 1,
  created_by text DEFAULT 'system'::text
);

CREATE TABLE audit_public_endpoints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_name text NOT NULL,
  action text NOT NULL,
  client_ip text NOT NULL,
  success boolean DEFAULT true,
  error_message text,
  request_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Super Admin
-- -----------------------------------------------------------------------------

CREATE TABLE onboarding_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_igreja text NOT NULL,
  cnpj text,
  email text NOT NULL,
  telefone text,
  nome_responsavel text NOT NULL,
  cidade text,
  estado text,
  status text NOT NULL DEFAULT 'pendente'::text,
  observacoes text,
  processado_por uuid,
  processado_em timestamp with time zone,
  igreja_id uuid REFERENCES igrejas(id),
  user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE tenant_metricas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  data_referencia date NOT NULL,
  total_membros integer DEFAULT 0,
  membros_ativos integer DEFAULT 0,
  total_eventos integer DEFAULT 0,
  total_transacoes integer DEFAULT 0,
  valor_transacoes numeric DEFAULT 0,
  storage_bytes bigint DEFAULT 0,
  total_midias integer DEFAULT 0,
  total_chamadas_api integer DEFAULT 0,
  total_erros_api integer DEFAULT 0,
  latencia_media_ms integer DEFAULT 0,
  total_checkins integer DEFAULT 0,
  total_pedidos_oracao integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE logs_replicacao_cadastros (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  igreja_id uuid NOT NULL REFERENCES igrejas(id),
  filial_origem_id uuid NOT NULL,
  filiais_destino_ids uuid[] NOT NULL,
  tabelas text[] NOT NULL,
  overwrite boolean DEFAULT false,
  resultado jsonb NOT NULL,
  user_id uuid,
  created_at timestamp with time zone DEFAULT now()
);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View: Crianças ausentes
CREATE VIEW view_absent_kids AS
SELECT 
  p.id as child_id,
  p.nome as full_name,
  p.data_nascimento,
  p.alergias,
  r.telefone as parent_phone,
  r.nome as parent_name,
  MAX(kc.checkin_at) as last_visit,
  EXTRACT(DAY FROM now() - MAX(kc.checkin_at)) as days_absent
FROM profiles p
LEFT JOIN familias f ON f.pessoa_id = p.id
LEFT JOIN profiles r ON r.id = f.familiar_id
LEFT JOIN kids_checkins kc ON kc.crianca_id = p.id
WHERE p.data_nascimento > (now() - interval '12 years')
GROUP BY p.id, p.nome, p.data_nascimento, p.alergias, r.telefone, r.nome;

-- View: Agenda da Secretaria
CREATE VIEW view_agenda_secretaria AS
SELECT 
  ap.id,
  ap.created_at,
  ap.status,
  ap.data_agendamento,
  ap.local_atendimento,
  ap.pastor_responsavel_id,
  pastor.nome as pastor_nome,
  pessoa.nome as pessoa_nome,
  ap.conteudo_original as conteudo
FROM atendimentos_pastorais ap
LEFT JOIN profiles pastor ON pastor.id = ap.pastor_responsavel_id
LEFT JOIN profiles pessoa ON pessoa.id = ap.pessoa_id;

-- View: Estatísticas de Edge Functions
CREATE VIEW view_edge_function_stats AS
SELECT 
  function_name,
  COUNT(*) as total_executions,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  COUNT(*) FILTER (WHERE status = 'timeout') as timeouts,
  ROUND(AVG(execution_time_ms)::numeric, 2) as avg_execution_time_ms,
  MAX(execution_time_ms) as max_execution_time_ms,
  MIN(execution_time_ms) as min_execution_time_ms,
  MAX(created_at) as last_execution,
  ROUND(COUNT(*) FILTER (WHERE status = 'success')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as success_rate
FROM edge_function_logs
GROUP BY function_name;

-- View: Estatísticas diárias de Edge Functions
CREATE VIEW view_edge_function_daily_stats AS
SELECT 
  function_name,
  DATE(created_at) as execution_date,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  ROUND(AVG(execution_time_ms)::numeric, 2) as avg_time_ms
FROM edge_function_logs
GROUP BY function_name, DATE(created_at)
ORDER BY execution_date DESC;

-- View: Score de Saúde do Membro
CREATE VIEW view_health_score AS
SELECT 
  p.id as pessoa_id,
  p.nome,
  p.status,
  p.avatar_url,
  COUNT(DISTINCT c.id) as score_presenca,
  COUNT(DISTINCT e.id) as score_servico,
  COALESCE(
    CASE 
      WHEN s.sentimento = 'muito_feliz' THEN 5
      WHEN s.sentimento = 'feliz' THEN 4
      WHEN s.sentimento = 'neutro' THEN 3
      WHEN s.sentimento = 'triste' THEN 2
      WHEN s.sentimento = 'muito_triste' THEN 1
    END, 3
  ) as score_sentimento
FROM profiles p
LEFT JOIN checkins c ON c.pessoa_id = p.id AND c.created_at > (now() - interval '90 days')
LEFT JOIN escalas e ON e.pessoa_id = p.id AND e.confirmado = true AND e.created_at > (now() - interval '90 days')
LEFT JOIN sentimentos_membros s ON s.pessoa_id = p.id
GROUP BY p.id, p.nome, p.status, p.avatar_url, s.sentimento;

-- View: Ocupação de Salas (Kids)
CREATE VIEW view_room_occupancy AS
SELECT 
  s.id as sala_id,
  s.nome as room_name,
  s.capacidade as capacity,
  s.idade_min,
  s.idade_max,
  COUNT(kc.id) as current_count,
  ROUND(COUNT(kc.id)::numeric / NULLIF(s.capacidade, 0) * 100, 2) as occupancy_rate
FROM salas s
LEFT JOIN kids_checkins kc ON kc.checkout_at IS NULL
GROUP BY s.id, s.nome, s.capacidade, s.idade_min, s.idade_max;

-- View: Check-ins ativos (Kids)
CREATE VIEW view_kids_checkins_ativos AS
SELECT 
  kc.id,
  kc.crianca_id,
  crianca.nome as crianca_nome,
  crianca.avatar_url as crianca_avatar,
  crianca.data_nascimento as crianca_data_nascimento,
  kc.responsavel_id,
  resp.nome as responsavel_nome,
  resp.telefone as responsavel_telefone,
  kc.checkin_at,
  kc.checkin_por,
  checkin_user.nome as checkin_por_nome,
  kc.evento_id,
  kc.observacoes
FROM kids_checkins kc
JOIN profiles crianca ON crianca.id = kc.crianca_id
JOIN profiles resp ON resp.id = kc.responsavel_id
LEFT JOIN profiles checkin_user ON checkin_user.id = kc.checkin_por
WHERE kc.checkout_at IS NULL;

-- View: Diário Kids com detalhes
CREATE VIEW view_kids_diario AS
SELECT 
  kd.*,
  crianca.nome as crianca_nome,
  crianca.avatar_url as crianca_avatar,
  crianca.data_nascimento as crianca_nascimento,
  prof.nome as professor_nome,
  e.titulo as culto_titulo,
  e.data_evento as culto_data
FROM kids_diario kd
JOIN profiles crianca ON crianca.id = kd.crianca_id
JOIN profiles prof ON prof.id = kd.professor_id
LEFT JOIN eventos e ON e.id = kd.culto_id;

-- View: Movimento Contábil
CREATE VIEW view_movimento_contabil AS
SELECT 
  t.id as transacao_id,
  t.data_competencia,
  t.data_pagamento,
  t.valor as valor_total_saida,
  t.categoria_id,
  t.subcategoria_id,
  t.centro_custo_id,
  t.base_ministerial_id,
  f.nome as fornecedor_nome,
  t.descricao as item_descricao,
  t.valor as item_valor,
  t.valor_liquido as valor_contabil,
  t.origem_registro as origem,
  t.tipo,
  t.status
FROM transacoes_financeiras t
LEFT JOIN fornecedores f ON f.id = t.fornecedor_id;

-- View: Solicitações de Reembolso com detalhes
CREATE VIEW view_solicitacoes_reembolso AS
SELECT 
  sr.*,
  p.nome as solicitante_nome,
  p.email as solicitante_email,
  p.telefone as solicitante_telefone,
  p.avatar_url as solicitante_avatar,
  COUNT(ir.id) as quantidade_itens
FROM solicitacoes_reembolso sr
JOIN profiles p ON p.id = sr.solicitante_id
LEFT JOIN itens_reembolso ir ON ir.solicitacao_id = sr.id
GROUP BY sr.id, p.nome, p.email, p.telefone, p.avatar_url;

-- View: Webhooks (sem secrets expostos)
CREATE VIEW webhooks_safe AS
SELECT 
  id,
  igreja_id,
  filial_id,
  tipo,
  url,
  enabled,
  CASE WHEN secret IS NOT NULL THEN '***' || RIGHT(secret, 4) ELSE NULL END as secret_masked,
  secret IS NOT NULL as has_secret,
  created_at,
  updated_at
FROM webhooks;

-- =============================================================================
-- FIM DO SCHEMA
-- =============================================================================

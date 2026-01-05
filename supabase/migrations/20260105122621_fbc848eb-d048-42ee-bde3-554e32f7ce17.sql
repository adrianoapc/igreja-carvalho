-- Criar tabela de logs de replicação
CREATE TABLE IF NOT EXISTS public.logs_replicacao_cadastros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  igreja_id UUID NOT NULL REFERENCES public.igrejas(id) ON DELETE CASCADE,
  filial_origem_id UUID NOT NULL REFERENCES public.filiais(id) ON DELETE CASCADE,
  filiais_destino_ids UUID[] NOT NULL,
  tabelas TEXT[] NOT NULL,
  overwrite BOOLEAN DEFAULT false,
  resultado JSONB NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_logs_replicacao_cadastros_igreja_id 
  ON public.logs_replicacao_cadastros(igreja_id);
CREATE INDEX IF NOT EXISTS idx_logs_replicacao_cadastros_user_id 
  ON public.logs_replicacao_cadastros(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_replicacao_cadastros_created_at 
  ON public.logs_replicacao_cadastros(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.logs_replicacao_cadastros ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "logs_replicacao_select_igreja" 
  ON public.logs_replicacao_cadastros FOR SELECT
  USING (igreja_id = public.get_current_user_igreja_id());

CREATE POLICY "logs_replicacao_insert_admin" 
  ON public.logs_replicacao_cadastros FOR INSERT
  WITH CHECK (
    igreja_id = public.get_current_user_igreja_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role) OR
      public.has_role(auth.uid(), 'admin_igreja'::app_role) OR
      public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- Comentário de documentação
COMMENT ON TABLE public.logs_replicacao_cadastros IS 
  'Registra operações de replicação de cadastros entre filiais para auditoria';
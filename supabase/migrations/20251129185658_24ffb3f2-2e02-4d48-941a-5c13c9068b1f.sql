-- Criar tabela para configurações de edge functions
CREATE TABLE IF NOT EXISTS public.edge_function_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  schedule_cron TEXT NOT NULL,
  schedule_description TEXT NOT NULL,
  last_execution TIMESTAMP WITH TIME ZONE,
  last_execution_status TEXT,
  execution_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.edge_function_config ENABLE ROW LEVEL SECURITY;

-- Policy para admins visualizarem
CREATE POLICY "Admins podem ver configurações"
ON public.edge_function_config
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Policy para admins atualizarem
CREATE POLICY "Admins podem atualizar configurações"
ON public.edge_function_config
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Policy para sistema inserir
CREATE POLICY "Sistema pode inserir configurações"
ON public.edge_function_config
FOR INSERT
WITH CHECK (true);

-- Inserir configurações padrão das edge functions existentes
INSERT INTO public.edge_function_config (function_name, schedule_cron, schedule_description) VALUES
('notificar-sentimentos-diario', '0 12 * * *', 'Diariamente às 9h (horário de Brasília)'),
('verificar-sentimentos-criticos', '0 11 * * *', 'Diariamente às 8h (horário de Brasília)'),
('notificar-aniversarios', '0 11 * * *', 'Diariamente às 8h (horário de Brasília)')
ON CONFLICT (function_name) DO NOTHING;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_edge_function_config_updated_at
BEFORE UPDATE ON public.edge_function_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para registrar execução de edge function
CREATE OR REPLACE FUNCTION public.log_edge_function_execution(
  p_function_name TEXT,
  p_status TEXT,
  p_details TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
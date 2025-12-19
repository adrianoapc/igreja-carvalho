-- Tabela para armazenar logs detalhados de execução das edge functions
CREATE TABLE IF NOT EXISTS public.edge_function_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  execution_time_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  error_message TEXT,
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index para queries por function_name e data
CREATE INDEX idx_edge_function_logs_function_name ON public.edge_function_logs(function_name);
CREATE INDEX idx_edge_function_logs_created_at ON public.edge_function_logs(created_at DESC);
CREATE INDEX idx_edge_function_logs_status ON public.edge_function_logs(status);

-- RLS
ALTER TABLE public.edge_function_logs ENABLE ROW LEVEL SECURITY;

-- Política: Apenas admins podem visualizar logs
CREATE POLICY "Admins podem visualizar logs"
ON public.edge_function_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Política: Edge functions podem inserir logs (via service role)
CREATE POLICY "Service pode inserir logs"
ON public.edge_function_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Função para registrar execução de edge function com métricas
CREATE OR REPLACE FUNCTION public.log_edge_function_with_metrics(
  p_function_name TEXT,
  p_status TEXT,
  p_execution_time_ms INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_request_payload JSONB DEFAULT NULL,
  p_response_payload JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Inserir log detalhado
  INSERT INTO public.edge_function_logs (
    function_name,
    execution_time_ms,
    status,
    error_message,
    request_payload,
    response_payload
  )
  VALUES (
    p_function_name,
    p_execution_time_ms,
    p_status,
    p_error_message,
    p_request_payload,
    p_response_payload
  )
  RETURNING id INTO v_log_id;
  
  -- Atualizar contador na tabela de configuração
  UPDATE public.edge_function_config
  SET 
    last_execution = now(),
    last_execution_status = p_status,
    execution_count = execution_count + 1,
    updated_at = now()
  WHERE function_name = p_function_name;
  
  RETURN v_log_id;
END;
$$;

-- View para estatísticas agregadas
CREATE OR REPLACE VIEW public.view_edge_function_stats AS
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
  ROUND((COUNT(*) FILTER (WHERE status = 'success')::numeric / NULLIF(COUNT(*), 0) * 100), 2) as success_rate
FROM public.edge_function_logs
GROUP BY function_name;

-- View para execuções por dia (últimos 30 dias)
CREATE OR REPLACE VIEW public.view_edge_function_daily_stats AS
SELECT 
  function_name,
  DATE(created_at) as execution_date,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'success') as successful,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  ROUND(AVG(execution_time_ms)::numeric, 2) as avg_time_ms
FROM public.edge_function_logs
WHERE created_at >= now() - INTERVAL '30 days'
GROUP BY function_name, DATE(created_at)
ORDER BY execution_date DESC;
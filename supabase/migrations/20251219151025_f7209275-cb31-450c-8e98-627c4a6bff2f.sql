-- Recriar views com SECURITY INVOKER (padrão seguro)
DROP VIEW IF EXISTS public.view_edge_function_stats;
DROP VIEW IF EXISTS public.view_edge_function_daily_stats;

-- View para estatísticas agregadas (SECURITY INVOKER = default)
CREATE VIEW public.view_edge_function_stats 
WITH (security_invoker = true) AS
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

-- View para execuções por dia (SECURITY INVOKER = default)
CREATE VIEW public.view_edge_function_daily_stats 
WITH (security_invoker = true) AS
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
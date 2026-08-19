-- Auditoria das ~161 funções não-fin_* flagadas por
-- anon_security_definer_function_executable (mesma investigação das
-- PRs #119-#122). 113 são funções de trigger (RETURNS trigger — não
-- expostas via PostgREST independente do grant, fora do escopo desta
-- migration). Das 48 restantes chamáveis via RPC, a maioria já se
-- protege sozinha (has_role/auth.uid()/checagem de service_role) ou é
-- intencionalmente pública (resolve_short_link, check_lote_disponivel).
--
-- Esta migration fecha as que NÃO têm guard interno e cujo(s) caller(s)
-- real(is) — checado via grep em src/ e supabase/functions/, não
-- suposição — já usam SERVICE_ROLE_KEY ou não têm caller nenhum (órfãs):
--   - desconciliar_transacao: zero caller (órfã). Mexe em
--     transacoes_financeiras/extratos_bancarios/conciliacoes_* sem
--     tenant check nenhum — qualquer um desfazia conciliação bancária
--     de qualquer igreja passando um transacao_id arbitrário.
--   - create_filial_short_links: zero caller (órfã).
--   - log_rate_limit_violation: callers reais (cadastro-publico,
--     checkin-evento, checkin-whatsapp-geo) usam SERVICE_ROLE_KEY.
--     Sem o fechamento, anon podia forjar violação com IP de outra
--     pessoa e causar bloqueio de 24h nela (griefing).
--   - log_edge_function_execution / log_edge_function_with_metrics:
--     callers reais são todos edge functions com SERVICE_ROLE_KEY.
--   - checkin_por_localizacao: caller real (checkin-whatsapp-geo) usa
--     SERVICE_ROLE_KEY. Sem o fechamento, anon podia forjar check-in
--     de presença passando coordenada GPS falsa (raio hardcoded).
--   - relatorio_duplicidade_pessoas: caller real
--     (automacao-duplicidade-pessoas) usa SERVICE_ROLE_KEY. Vazava
--     contagens agregadas de TODAS as igrejas (sem filtro de tenant).
--   - limpar_otps_expirados / refresh_conciliacao_dataset: zero caller
--     — provavelmente pensadas pra pg_cron, nunca agendadas.
--
-- notify_admins e set_audit_context TÊM caller legítimo em
-- `authenticated` (telas internas, não formulário público) — fecha só
-- PUBLIC/anon, mantém authenticated como já estava.
--
-- Achados que NÃO cabem aqui (precisam de fix de lógica, não só grant,
-- porque authenticated tem uso legítimo real mas a RPC não valida quem
-- está chamando): get_user_auth_context, calcular_metricas_tenant,
-- rejeitar_sugestao_conciliacao, open_sessao_contagem — tratados em
-- migration separada.

REVOKE ALL ON FUNCTION public.desconciliar_transacao(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_filial_short_links(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_rate_limit_violation(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_edge_function_execution(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_edge_function_with_metrics(text, text, integer, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkin_por_localizacao(text, double precision, double precision) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.relatorio_duplicidade_pessoas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.limpar_otps_expirados() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_conciliacao_dataset() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.notify_admins(text, text, text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_audit_context(uuid, text) FROM PUBLIC, anon;

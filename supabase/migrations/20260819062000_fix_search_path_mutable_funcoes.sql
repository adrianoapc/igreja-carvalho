-- Linter Supabase (function_search_path_mutable): 8 funções sem
-- search_path fixo. Todas já referenciam suas tabelas com schema
-- qualificado (public.xxx) nos corpos atuais (confirmado via
-- pg_get_functiondef ao vivo), então fixar o search_path não muda
-- comportamento nenhum — só fecha a superfície teórica de schema
-- injection (alguém criar um objeto com o mesmo nome não-qualificado
-- num schema anterior no search_path da sessão/role).
ALTER FUNCTION public.atualizar_updated_at_solicitacao() SET search_path = public, pg_temp;
ALTER FUNCTION public.fin_e_espelho_getnet(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_default_filial_id(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.getnet_safe_uuid(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.getnet_valida_conta_id_tenant() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.registrar_presenca_entrada_kids() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_kids_diario_updated_at() SET search_path = public, pg_temp;

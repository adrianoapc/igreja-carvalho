-- Linter Supabase: 2 achados triviais restantes depois da PR #119.

-- 1) function_search_path_mutable: fin_e_movimentacao_contamax ficou de
-- fora do fix de 20260819062000 (só cobriu 8 das 9 funções apontadas
-- naquela rodada). Corpo é LANGUAGE sql puro, sem referência a tabela
-- nenhuma (só ILIKE num parâmetro) — fixar search_path não muda
-- comportamento, só fecha a superfície teórica de schema injection.
ALTER FUNCTION public.fin_e_movimentacao_contamax(text) SET search_path = public, pg_temp;

-- 2) duplicate_index: checkins (renomeada de presencas_culto em
-- 20251228153744 — os índices ficaram com o nome antigo, o rename de
-- tabela não renomeia índice) e user_filial_access têm UNIQUE constraint
-- duplicada (a mesma coluna, criada duas vezes em migrations diferentes
-- — a original veio de UNIQUE(...) inline no CREATE TABLE, depois
-- alguém adicionou uma segunda com nome próprio sem notar que já
-- existia). Nenhum FK, ON CONFLICT ou código em src/ referencia os nomes
-- auto-gerados (*_key) — mantém as com nome descritivo, dropa as
-- auto-geradas.
ALTER TABLE public.checkins DROP CONSTRAINT presencas_culto_culto_id_pessoa_id_key;
ALTER TABLE public.user_filial_access DROP CONSTRAINT user_filial_access_user_id_filial_id_key;

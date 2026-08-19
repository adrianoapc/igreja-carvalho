-- Linter Supabase (security_definer_view): 10 views rodam como
-- SECURITY DEFINER (padrão implícito de view no Postgres/Supabase — o
-- dono, normalmente `postgres`, tem RLS bypassado), ignorando o RLS de
-- quem consulta.
--
-- Testado ao vivo (não só leitura de código) contra o projeto
-- ugnrumtngcskbfpwynsr, dentro de transações BEGIN/ROLLBACK (nunca
-- commitadas), simulando um usuário autenticado real via
-- `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = ...`:
--
-- ACHADO CRÍTICO confirmado (motivou esta migration): um usuário
-- autenticado com role 'basico' (sem admin/tesoureiro, sem nenhuma
-- permissão financeira) via `view_movimento_contabil` conseguia ler
-- **786 linhas** (o ledger financeiro INTEIRO, das duas igrejas que têm
-- dados em produção) — contra **0 linhas** ao consultar
-- `transacoes_financeiras` diretamente (RLS real aplicado). Mesmo teste
-- em `view_reconciliacao_cobertura`: 17 linhas via view x 0 linhas via
-- `extratos_bancarios` direto. Confirmado também que um usuário
-- 'admin' (role global nesta base, não escopado por igreja — ver
-- has_filial_access) continua vendo os mesmos dados nos dois caminhos
-- depois da correção — sem regressão para quem tem acesso legítimo.
--
-- `security_invoker = true` (Postgres 15+) faz a view rodar com o RLS de
-- quem consulta, e não do dono — fecha o vazamento sem mudar a definição
-- da view.
ALTER VIEW public.view_movimento_contabil SET (security_invoker = true);
ALTER VIEW public.view_reconciliacao_cobertura SET (security_invoker = true);

-- As 6 views abaixo (módulo kids/pastoral/eventos) têm 0 linhas em
-- produção hoje (tabelas-base sem dados ainda) — nenhum vazamento ativo
-- observável no teste, mas o mesmo padrão (DEFINER + grant amplo pra
-- anon/authenticated) se aplica assim que houver dado real. Confirmado
-- que as tabelas-base já têm RLS coerente com o uso esperado de cada
-- view (staff/líder/secretário/responsável, escopado por
-- has_filial_access onde a tabela tem a coluna) — troca seguro.
-- view_agenda_secretaria e view_kids_checkins_ativos e
-- view_faltas_evento também não têm nenhum call site em src/ hoje
-- (grep) — risco adicional zero de quebrar tela em uso.
ALTER VIEW public.view_absent_kids SET (security_invoker = true);
ALTER VIEW public.view_room_occupancy SET (security_invoker = true);
ALTER VIEW public.view_kids_diario SET (security_invoker = true);
ALTER VIEW public.view_agenda_secretaria SET (security_invoker = true);
ALTER VIEW public.view_kids_checkins_ativos SET (security_invoker = true);
ALTER VIEW public.view_faltas_evento SET (security_invoker = true);

-- comunicados_publicos: view pública de propósito (banners do site sem
-- login). A tabela-base `comunicados` já tem uma policy dedicada pra
-- role anon ("anon_banners_site") com o MESMO filtro exato da view
-- (tipo='banner' AND exibir_site AND ativo AND janela de data) —
-- confirmado comparando as duas definições. security_invoker não muda
-- nada pra quem já é o público-alvo (anon), só deixa de rodar com
-- privilégio de dono.
ALTER VIEW public.comunicados_publicos SET (security_invoker = true);

-- eventos_publicos: MANTIDA SECURITY DEFINER (não mudar sem investigar
-- de novo se `comunicados`/`eventos` ganharem policy nova). A view faz
-- um subselect correlacionado em `comunicados` pra achar o banner_url
-- do evento (`WHERE evento_id = e.id AND imagem_url IS NOT NULL AND
-- ativo = true` — sem checar exibir_site nem a janela de data). A
-- policy anon de `comunicados` ("anon_banners_site") exige tipo='banner'
-- + exibir_site=true + janela de data — mais estrita que o subselect da
-- view. Sob security_invoker, uma imagem anexada a um evento público mas
-- SEM exibir_site=true (ex.: banner só da página do próprio evento, não
-- do carrossel geral do site) deixaria de aparecer em banner_url pra
-- anon — regressão de produto que não dá pra confirmar nem descartar
-- sem dado real (tabela `eventos` tem 1 linha hoje, nenhuma pública).
-- `eventos` já tem policy "Membros visualizam eventos"/"anon_eventos_site"
-- com o mesmo filtro do SELECT principal da view, então o risco está
-- isolado no subselect de banner_url, não na lista de eventos em si.
COMMENT ON VIEW public.eventos_publicos IS
  'SECURITY DEFINER mantido de propósito: subselect correlacionado em '
  'comunicados (banner_url) é mais permissivo que a policy anon '
  '(anon_banners_site) daquela tabela — trocar pra security_invoker sem '
  'dado real pra testar arrisca esconder banner de evento público. '
  'Ver migration 20260819064000.';

-- Linter Supabase (policy_exists_rls_disabled / rls_disabled_in_public):
-- estas 5 tabelas já têm policies criadas (confirmado ao vivo via
-- `supabase db advisors --linked` + `pg_policies` no projeto ugnrumtngcskbfpwynsr),
-- mas RLS está desligado — as policies existentes nunca chegam a ser
-- avaliadas. Ligar RLS aqui só faz as policies já escritas passarem a
-- valer; não cria nenhuma regra nova.
--
-- Confirmado ao vivo (não só via arquivo de migration, que tem drift
-- conhecido nesta tabela — ver AGENTS.md) que as policies abaixo já
-- existem em produção antes desta migration:
--   configuracoes_financeiro: "Admin/Tesoureiro gerenciam config da própria igreja"
--   itens_reembolso: "Admins e tesoureiros podem gerenciar itens",
--     "Admins e tesoureiros podem ver todos itens",
--     "Edge functions podem inserir itens_reembolso",
--     "Ver itens dos próprios reembolsos"
--   liturgia_culto: "Admins podem gerenciar liturgia", "Membros podem ver liturgia"
--   midias_culto: "Admins podem gerenciar mídias", "Membros podem ver mídias"
--   times_culto: "Admins podem gerenciar times", "Membros podem ver times ativos"

ALTER TABLE public.configuracoes_financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_reembolso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liturgia_culto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.midias_culto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.times_culto ENABLE ROW LEVEL SECURITY;

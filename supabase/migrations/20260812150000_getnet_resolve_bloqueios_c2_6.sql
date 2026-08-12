-- ============================================================================
-- Resolve os 2 bloqueios documentados na C2-6 pra getnet_credito_disponivel
-- virar fonte durável de verdade — decisão explícita do usuário: fechar
-- isso mesmo sem consumidor ainda (a view/tabelas base ficam seguras pra
-- qualquer uso futuro, incluindo a eventual C2-8).
--
-- Achado, durante a pesquisa: `getnet_credito_disponivel` já tinha `GRANT
-- SELECT ... TO authenticated` — PostgREST expõe automaticamente QUALQUER
-- view/tabela com esse grant via API REST, então "sem consumidor no
-- frontend ainda" não significava "sem exposição real": qualquer
-- tesoureiro/admin da igreja já podia consultar a view direto
-- (`supabase.from('getnet_credito_disponivel')`) e ver `filial_id` sem
-- nenhuma checagem de `has_filial_access` — o gap já era live, não só
-- teórico.
--
-- ─── 1. Bloqueio has_filial_access — revoga acesso direto ──────────────────
-- Em vez de construir uma RPC wrapper agora (sem consumidor real ainda,
-- seria abstração prematura), fecha o acesso direto: só service_role
-- consulta a view a partir daqui. Qualquer consumidor futuro (C2-8 ou
-- outro) precisa de uma RPC SECURITY DEFINER nova com has_filial_access —
-- não tem outro jeito de ler os dados, o que evita reintroduzir o mesmo
-- gap por esquecimento.
REVOKE SELECT ON public.getnet_credito_disponivel FROM authenticated;

COMMENT ON VIEW public.getnet_credito_disponivel IS
  'Ciclo 2 C2-6: crédito Getnet disponível, direto de getnet_resumo (LQ)/getnet_financeiro_resumo (PG) — equivalente aditivo ao espelho hoje escrito em extratos_bancarios (origem getnet_sftp_txt/getnet_sftp_tipo5). Fonte por arquivo travada em getnet_arquivos.espelho_origem (allow-list explícita, LEFT JOIN — arquivo sem linha em getnet_arquivos cai no fallback tipo1, mesma regra do NULL). conta_id vem SEMPRE da coluna própria (congelada no import, FK pra contas, ON DELETE SET NULL) — nunca relida da config atual; NULL é um estado final (atribuição desconhecida), não recalculado a cada consulta. Puramente leitura; nenhum consumidor ainda. SELECT revogado de authenticated (bloqueios da C2-6 resolvidos nesta migration) — só service_role/superuser consulta direto; qualquer consumidor futuro precisa de RPC SECURITY DEFINER nova com has_filial_access (filial_id aqui NÃO é filtrado por RLS). security_invoker=true — herda RLS (só igreja_id) das tabelas base, mas isso não basta sozinho, daí o REVOKE.';

-- ─── 2. Bloqueio ON DELETE CASCADE — vira RESTRICT nas tabelas de dado ─────
-- Escopo: só as 8 tabelas que carregam DADO (histórico de import +
-- vínculos de reconciliação confirmados). `integracoes_financeiras_
-- secrets` (credenciais, sem valor de dado — faz sentido sumir junto) e
-- `integracoes_execucoes_log` (log de execução, não histórico financeiro)
-- CONTINUAM com CASCADE — mudar essas duas não tem o mesmo motivo de
-- proteção e tornaria impossível limpar credenciais órfãs.
--
-- RESTRICT, não SET NULL: `integracao_id` é NOT NULL nas 8 tabelas — SET
-- NULL exigiria tirar essa constraint, e uma linha `getnet_resumo`/
-- `getnet_recebivel_lancamentos` sem saber de qual integração veio perde
-- sentido (não dá pra saber qual conta/config gerou aquele dado). RESTRICT
-- é a escolha certa quando o dado referenciado tem valor duradouro por si
-- só (guardrail J) — bloqueia o DELETE em vez de perder o vínculo
-- silenciosamente.
--
-- Confirmado antes desta migration: `getnet-sync-automatico` (cron diário)
-- já filtra `WHERE status = 'ativo'` — "Inativar" (toggle já existente em
-- IntegracoesCriarDialog.tsx, `status='inativo'`) já é uma alternativa
-- REAL e funcional ao hard delete, só não estava oferecida no momento da
-- exclusão. Consumidores atuais de getnet_recebivel_lancamentos.
-- extrato_bancario_id/getnet_antecipacao_lotes.extrato_bancario_id (Hop1,
-- fin_conferencia_totais_getnet, ledger) continuam funcionando
-- exatamente igual — RESTRICT só muda o que acontece quando alguém tenta
-- excluir a integração, não nenhuma leitura existente.
ALTER TABLE public.getnet_resumo
  DROP CONSTRAINT getnet_resumo_integracao_id_fkey,
  ADD CONSTRAINT getnet_resumo_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE public.getnet_analitico
  DROP CONSTRAINT getnet_analitico_integracao_id_fkey,
  ADD CONSTRAINT getnet_analitico_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE public.getnet_arquivos
  DROP CONSTRAINT getnet_arquivos_integracao_id_fkey,
  ADD CONSTRAINT getnet_arquivos_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE public.getnet_ajustes
  DROP CONSTRAINT getnet_ajustes_integracao_id_fkey,
  ADD CONSTRAINT getnet_ajustes_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE public.getnet_financeiro_resumo
  DROP CONSTRAINT getnet_financeiro_resumo_integracao_id_fkey,
  ADD CONSTRAINT getnet_financeiro_resumo_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE public.getnet_financeiro_detalhe
  DROP CONSTRAINT getnet_financeiro_detalhe_integracao_id_fkey,
  ADD CONSTRAINT getnet_financeiro_detalhe_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE public.getnet_recebivel_lancamentos
  DROP CONSTRAINT getnet_recebivel_lancamentos_integracao_id_fkey,
  ADD CONSTRAINT getnet_recebivel_lancamentos_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE public.getnet_antecipacao_lotes
  DROP CONSTRAINT getnet_antecipacao_lotes_integracao_id_fkey,
  ADD CONSTRAINT getnet_antecipacao_lotes_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

-- F7 (sub-frente 1/5): revogar escrita direta do role authenticated.
--
-- Contexto (docs/arquitetura-financeiro.md §7.1, "regra de ouro"): nenhum canal
-- deveria fazer INSERT/UPDATE/DELETE direto nas tabelas do CORE financeiro —
-- escrita só via RPC `fin_*` (SECURITY DEFINER). As fases F1-F5 migraram os
-- call-sites de escrita para essas RPCs, mas o GRANT de escrita do role
-- `authenticated` nunca tinha sido revogado — a regra valia só por convenção
-- de código, não por enforcement do banco.
--
-- Auditoria (jul/2026, ver docs/arquitetura-financeiro.md §9.6) encontrou 7
-- tabelas do domínio: `transacoes_financeiras`, `transferencias_contas`,
-- `extratos_bancarios`, `conciliacoes_lote`, `conciliacoes_lote_extratos`,
-- `conciliacoes_divisao`, `conciliacoes_divisao_transacoes`. Resultado:
--
--   * `transferencias_contas`, `conciliacoes_lote`, `conciliacoes_lote_extratos`,
--     `conciliacoes_divisao`, `conciliacoes_divisao_transacoes` — 100% migradas
--     (nenhum .insert/.update/.delete direto restante em src/ ou
--     supabase/functions/**, fora das RPCs fin_*). REVOKE aplicado.
--
--   * `transacoes_financeiras` e `extratos_bancarios` — AINDA TÊM call-sites de
--     escrita direta no frontend (rodam como `authenticated` via PostgREST, não
--     service_role) fora do core/api. Ex.: TransacaoActionsMenu.tsx
--     (handleToggleConferidoManual), TransacaoDetalheDrawer.tsx (handleSave),
--     VincularTransacaoDialog.tsx (handleVincular), QuickCreateTransacaoDialog.tsx,
--     HistoricoExtratos.tsx (handleIgnorar/handleReativar/handleDesvincular),
--     ConciliacaoManual.tsx e DashboardConciliacao.tsx (handleIgnorar),
--     ConciliacaoInteligente.tsx (marcar conciliado_manual), ImportarTab.tsx e
--     ImportarFinancasPage.tsx (insert em lote de lançamentos), MeusCursos.tsx,
--     InscricoesTabContent.tsx e AdicionarInscricaoDialog.tsx (criam transação
--     de pagamento de inscrição). REVOGAR aqui quebraria esses fluxos em
--     produção — NÃO revogado nesta migration. Fica para a próxima fatia da F7
--     (decomposição das telas de conciliação) migrar esses call-sites para
--     RPCs fin_* antes de fechar o REVOKE nessas duas tabelas. Detalhe completo
--     em docs/arquitetura-financeiro.md §9.6.
--
-- Todas as RPCs `fin_*` de escrita são SECURITY DEFINER, de propriedade do
-- role que roda as migrations (mesmo dono de todas as demais funções do
-- schema, com privilégio pleno de escrita nas tabelas) — revogar de
-- `authenticated` não afeta o funcionamento delas (o corpo da função roda com
-- o privilégio do DONO, não do chamador). `service_role` nunca teve o GRANT
-- tocado aqui e continua com escrita íntegra (edges usam
-- SUPABASE_SERVICE_ROLE_KEY, não o JWT do usuário — confirmado por auditoria
-- em supabase/functions/**: getnet-sftp, santander-extrato, reclass-transacoes,
-- undo-reclass, undo-import e chatbot-financeiro escrevem via client de
-- service role, não como `authenticated`).
--
-- SELECT não é tocado (RLS continua sendo a camada de controle de leitura).

REVOKE INSERT, UPDATE, DELETE ON public.transferencias_contas
  FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.conciliacoes_lote
  FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.conciliacoes_lote_extratos
  FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.conciliacoes_divisao
  FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.conciliacoes_divisao_transacoes
  FROM authenticated, anon;

-- ─── RPCs legadas de conciliação (motor/aplicador pré-F4) ───────────────────
-- `reconciliar_transacoes`, `aplicar_conciliacao` e `gerar_candidatos_conciliacao`
-- foram marcadas DEPRECADA via COMMENT na migration 20260711150000 (F4), com
-- DROP planejado para a F7. Auditoria desta fase (jul/2026) confirmou ZERO
-- call-sites vivos em src/ e supabase/functions/** (a edge gerar-sugestoes-ml
-- já migrou para fin_gerar_candidatos_conciliacao desde a F5 — confirmado
-- lendo o corpo do arquivo, não só o comentário desatualizado do cabeçalho).
--
-- Bônus encontrado na mesma auditoria: `aplicar_sugestao_conciliacao(uuid,uuid)`
-- (SECURITY DEFINER, mesmo padrão de escrita direta em extratos_bancarios/
-- transacoes_financeiras/conciliacoes_lote) só é chamada por
-- `src/components/financas/SugestoesML.tsx` — componente órfão, sem import em
-- nenhuma rota/tela (código morto). Tratada aqui junto com as 3 nomeadas por
-- ser a mesma categoria de risco (função SECURITY DEFINER com EXECUTE aberto
-- por padrão a PUBLIC, escrevendo direto nas tabelas que este REVOKE protege).
-- `rejeitar_sugestao_conciliacao` NÃO entra: ainda é chamada de
-- ConciliacaoInteligente.tsx (call-site vivo) — fora de escopo desta fatia.
--
-- DROP via loop sobre pg_proc (por nome, não assinatura fixa): o histórico das
-- migrations mostra que `aplicar_conciliacao` teve DUAS assinaturas ao longo do
-- tempo (2 args em 20260116035619, 5 args a partir de 20260203172530) sem
-- nenhum DROP FUNCTION explícito no meio — plausível que ambos os overloads
-- ainda existam no schema real. Iterar por nome garante que todo overload
-- remanescente é removido mesmo que a assinatura real de produção divirja do
-- que está documentado aqui (risco de drift schema real × migrations, §11).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'reconciliar_transacoes',
        'aplicar_conciliacao',
        'gerar_candidatos_conciliacao',
        'aplicar_sugestao_conciliacao'
      )
  LOOP
    EXECUTE format('DROP FUNCTION public.%I(%s)', r.proname, r.args);
    RAISE NOTICE '[F7] DROP FUNCTION public.%(%) — legada sem call-site vivo (auditoria jul/2026)', r.proname, r.args;
  END LOOP;
END $$;

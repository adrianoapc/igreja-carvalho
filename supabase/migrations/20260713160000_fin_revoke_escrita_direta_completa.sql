-- F7 (sub-frente 1/5): fecha a revogação de escrita direta do role
-- `authenticated` nas 2 tabelas que a migration 20260713141000 deixou de
-- fora — transacoes_financeiras e extratos_bancarios. Naquela migration elas
-- ficaram abertas porque a auditoria daquela rodada encontrou call-sites de
-- escrita direta ainda vivos no frontend (fora de core/api/); esta migration
-- só é segura porque esses call-sites foram migrados para RPCs `fin_*` nos
-- commits imediatamente anteriores (ver docs/arquitetura-financeiro.md §9.7):
--
--   TransacaoActionsMenu (handleToggleConferidoManual), TransacaoDetalheDrawer
--   (handleSave), VincularTransacaoDialog (handleVincular),
--   QuickCreateTransacaoDialog, HistoricoExtratos (handleIgnorar/
--   handleReativar/handleDesvincular), ConciliacaoManual e
--   DashboardConciliacao (handleIgnorar), ConciliacaoInteligente (marcar
--   conciliado_manual), ImportarTab e ImportarFinancasPage (insert em lote de
--   lançamentos), MeusCursos, InscricoesTabContent e AdicionarInscricaoDialog
--   (criação da transação de pagamento de inscrição/curso).
--
-- Reauditoria (mesmo processo de grep/leitura da migration anterior) em
-- src/** e supabase/functions/**, fora de core/api/: zero `.insert/.update/
-- .delete/.upsert` vivo restante encadeado em `.from("transacoes_financeiras")`
-- ou `.from("extratos_bancarios")`. Os dois únicos hits que o grep ainda
-- encontra (`ImportarExcelDialog.tsx`, `ImportarExcelWizard.tsx`) são código
-- morto confirmado — nenhuma rota/tela importa esses componentes (superados
-- pelo wizard `ImportarTab`/`ImportarFinancasPage`, já migrados). Não foram
-- removidos (fora do escopo desta fatia: limpeza de código morto genérica é
-- a frente 5/5 da F7); documentados aqui para rastreabilidade.
--
-- `supabase/functions/**` continua não bloqueando o REVOKE: os únicos edges
-- que escrevem direto nessas duas tabelas (getnet-sftp, santander-extrato,
-- reclass-transacoes, undo-reclass, undo-import) usam
-- SUPABASE_SERVICE_ROLE_KEY — rodam como `service_role`, não `authenticated`
-- (mesma verificação da migration anterior, reconfirmada).
--
-- Achado colateral (fora de escopo, só registro): a migração de
-- HistoricoExtratos.handleDesvincular trocou a chamada direta pela RPC
-- legada `desconciliar_transacao` (nome antigo, pré-fin_*) por
-- `fin_desconciliar` — `desconciliar_transacao` fica sem nenhum call-site
-- vivo a partir deste commit. Não é uma das RPCs nomeadas para DROP nesta
-- fatia (a de 20260713141000 tratou só as 3+1 do motor de conciliação
-- legado); fica para uma limpeza futura de código morto (frente 5/5).
--
-- SELECT não é tocado — RLS continua controlando leitura. As RPCs fin_* são
-- SECURITY DEFINER (mesmo dono com privilégio pleno de escrita das demais
-- migrations fin_*) — revogar de authenticated não afeta seu funcionamento.

REVOKE INSERT, UPDATE, DELETE ON public.transacoes_financeiras
  FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.extratos_bancarios
  FROM authenticated, anon;

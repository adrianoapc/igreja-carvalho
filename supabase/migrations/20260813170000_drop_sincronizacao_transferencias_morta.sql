-- ============================================================================
-- Remove o sistema de "sincronização de conciliações em transferências"
-- (fev/2026, docs/_archive/IMPLEMENTACAO_SINCRONIZACAO_TRANSFERENCIAS.md) —
-- já registrado como órfão em docs/arquitetura-financeiro.md §9.10 desde
-- jul/2026, quando o widget frontend (SincronizacaoTransferenciasWidget.tsx)
-- foi removido por falta de caller.
--
-- Achado ao investigar um fix perdido num stash: a edge function
-- `sync-transferencias-conciliacao` estava quebrada há meses (Deno.core
-- não existe no runtime público + service_role sem claims de JWT pra
-- fin_resolver_contexto/get_jwt_igreja_id), então nunca fazia dano — mas
-- consertar o client teria reativado uma RPC que viola 3 guardrails ao
-- mesmo tempo: escreve direto em transacoes_financeiras fora do padrão
-- fin_*, não valida has_filial_access (sincroniza TODAS as filiais do
-- tenant quando o JWT não tem filial), e não checa autorizado_lancar_*
-- (qualquer autenticado com igreja_id dispara o lote).
--
-- Decisão: não revive-la. O trabalho que ela fazia (sincronizar a perna
-- irmã de uma transferência quando a outra é conciliada) já é feito,
-- melhor, dentro de fin_confirmar_conciliacao (20260711140000, L184-205)
-- — atômico, na mesma transação da conciliação, com has_filial_access
-- (20260804300000). Confirmado sem caller real em src/ pras 3 funções
-- (só aparecem em supabase/migrations, supabase/scripts/ — removidos
-- junto — e no types.ts gerado, que lista toda função pública).
--
-- auditoria_conciliacoes (tabela criada na mesma migration original) NÃO
-- é tocada aqui — tem policies/uso mais amplo que só estas 3 funções
-- (20260608131528), fora do escopo desta limpeza.
-- ============================================================================

DROP FUNCTION IF EXISTS public.sincronizar_transferencias_reconciliacao(integer);
DROP FUNCTION IF EXISTS public.sincronizar_conciliacao_transferencias(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.contar_transferencias_dessincronizadas(uuid, uuid);

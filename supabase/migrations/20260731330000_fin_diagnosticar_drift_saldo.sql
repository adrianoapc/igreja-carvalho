-- ============================================================================
-- 1 achado do /code-review (PR #67, rodada de 02/08 02:56, commit revisado
-- de4ba627), real — mas de uma natureza diferente dos achados anteriores:
--
-- `_fin_recalcular_saldo_conta_raw` (20260731190000/200000) sempre
-- recalcula `saldo_atual = saldo_inicial + Σ(transações pagas)` — é o
-- executor único de saldo, dispara em todo INSERT/UPDATE/DELETE pago
-- (20260731210000). Se alguma conta tiver um AJUSTE MANUAL histórico feito
-- via `UPDATE contas SET saldo_atual = ...` direto (antes de `fin_ajustar_
-- saldo` existir como RPC auditável, ou qualquer correção manual fora do
-- ledger), esse ajuste NÃO está refletido nem em `saldo_inicial` nem em
-- nenhuma linha de `transacoes_financeiras` — a fórmula não tem como saber
-- que ele existe. A PRÓXIMA transação paga comum dispara o recálculo, que
-- sobrescreve `saldo_atual` com o valor "limpo" da fórmula, apagando o
-- ajuste histórico em silêncio.
--
-- Isso NÃO é um bug de lógica no trigger — o trigger está fazendo
-- exatamente o que deveria (garantir o invariante `saldo_atual =
-- saldo_inicial + Σ transações`). É uma PRECONDIÇÃO DE DEPLOY: antes desta
-- cadeia de triggers alcançar um banco com dados históricos reais, cada
-- conta precisa ser conferida — se `saldo_atual` (antes do deploy) diverge
-- da fórmula, alguém precisa decidir: (a) é um ajuste legítimo → dobra a
-- diferença em `saldo_inicial` (preserva o valor, o invariante passa a
-- valer dali pra frente sem perder histórico), ou (b) é um bug/drift real
-- → investiga antes de aceitar. Corrigir isso automaticamente às cegas
-- (sem revisão humana) arriscaria mascarar um bug real como se fosse um
-- "ajuste legítimo".
--
-- Esta migration NÃO mexe em dado nenhum — adiciona uma função de
-- diagnóstico só-leitura (`fin_diagnosticar_drift_saldo`) que lista, por
-- conta, `saldo_atual` registrado vs. o que a fórmula calcularia, e a
-- diferença. Vira o passo 0 obrigatório do runbook de deploy desta PR (ver
-- docs/arquitetura-financeiro.md §9.72): rodar isso ANTES de qualquer
-- deploy pra um ambiente com dados reais, revisar cada linha retornada
-- manualmente.
--
-- Achado do /code-review, rodada seguinte (§9.73): a primeira versão
-- desta função filtrava só por `igreja_id` (tenant), sem `has_filial_
-- access` nenhum — sendo `SECURITY DEFINER` (bypassa RLS de contas/
-- transações), um tesoureiro restrito a UMA filial que chamasse esta RPC
-- "só de diagnóstico" via app/devtools enxergava nome, saldo registrado,
-- saldo calculado e diferença de TODAS as contas do tenant, de qualquer
-- filial — exatamente a mesma classe de vazamento já documentada em
-- §9.61/§9.68, cometida de novo aqui, numa função nova, na MESMA sessão
-- que documentou a classe inteira. Fix: `has_filial_access` por conta —
-- `has_filial_access` já libera geral pra quem tem papel admin/
-- super_admin (é exatamente quem deveria rodar este diagnóstico antes de
-- um deploy), e restringe tesoureiro comum à própria filial.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fin_diagnosticar_drift_saldo(
  p_contexto jsonb DEFAULT NULL
)
RETURNS TABLE(
  conta_id uuid,
  conta_nome text,
  saldo_atual_registrado numeric,
  saldo_calculado_formula numeric,
  diferenca numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
BEGIN
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  RETURN QUERY
  SELECT c.id,
         c.nome,
         c.saldo_atual,
         v_calc.saldo_calculado,
         c.saldo_atual - v_calc.saldo_calculado
    FROM public.contas c
    CROSS JOIN LATERAL (
      SELECT COALESCE(c.saldo_inicial, 0) + COALESCE(SUM(
               CASE WHEN t.tipo = 'entrada' THEN COALESCE(t.valor_liquido, t.valor)
                    ELSE -COALESCE(t.valor_liquido, t.valor) END
             ), 0) AS saldo_calculado
        FROM public.transacoes_financeiras t
       WHERE t.conta_id = c.id AND t.status = 'pago'
    ) v_calc
   WHERE c.igreja_id = v_igreja
     AND public.has_filial_access(v_igreja, c.filial_id)
     AND c.saldo_atual IS DISTINCT FROM v_calc.saldo_calculado
   ORDER BY abs(c.saldo_atual - v_calc.saldo_calculado) DESC;
END;
$$;

COMMENT ON FUNCTION public.fin_diagnosticar_drift_saldo(jsonb) IS
  'Diagnóstico só-leitura: lista contas cujo saldo_atual diverge da fórmula (saldo_inicial + Σ transações pagas). Ferramenta de monitoramento CONTÍNUO pós-deploy — NÃO serve como gate de pré-deploy desta PR (ela só existe a partir desta migration, várias migrations depois do trigger "sempre recalcula" já estar ativo e do backfill de forma_pagamento_id já ter apagado qualquer drift histórico). O passo 0 de pré-deploy de verdade é a query standalone documentada em docs/arquitetura-financeiro.md §9.77, rodada manualmente ANTES de iniciar supabase db push.';

GRANT EXECUTE ON FUNCTION public.fin_diagnosticar_drift_saldo(jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_diagnosticar_drift_saldo(jsonb) FROM anon;

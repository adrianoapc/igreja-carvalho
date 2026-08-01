-- ============================================================================
-- Fix real do /code-review (PR #67, 26ª rodada) sobre o trigger de saldo
-- de §9.50/§9.53 (atualizar_saldo_conta, FOR EACH ROW):
--
-- Um job de reclassificação em massa (reclass-transacoes, até 5000
-- transações) que muda status dispara o trigger UMA VEZ POR LINHA — cada
-- disparo chama _fin_recalcular_saldo_conta_raw, que faz uma SUM completa
-- sobre TODO o histórico pago da conta mais um SELECT FOR UPDATE. Pra N
-- linhas afetando a MESMA conta, isso é N recálculos redundantes (só o
-- último importa) — em contas com muitas linhas e jobs grandes, essa
-- repetição pode causar timeout/lock contention e abortar um job de
-- reclassificação inteiro que seria válido. O mesmo padrão se repete no
-- DELETE em massa do undo-import.
--
-- Achado extra encontrado ao investigar este mesmo trigger: o antigo
-- `UPDATE OF status` também deixava passar batido uma reclassificação que
-- muda só `conta_id` (sem status no SET, igual ao gap já fechado em
-- proteger_desagio_vinculado/§9.53) — mover uma linha PAGA de conta sem
-- tocar o status nunca recalculava NENHUMA das duas contas envolvidas.
--
-- Fix: trigger sai de FOR EACH ROW pra FOR EACH STATEMENT, usando
-- transition tables (REFERENCING OLD TABLE/NEW TABLE, disponível desde
-- PG10) pra coletar todas as contas afetadas pela statement INTEIRA de
-- uma vez, e chama _fin_recalcular_saldo_conta_raw UMA VEZ por conta
-- DISTINTA — não mais uma vez por linha. 3 triggers separados (um por
-- operação: INSERT só tem NEW TABLE, DELETE só tem OLD TABLE, UPDATE tem
-- os dois) porque a cláusula REFERENCING precisa bater exatamente com o
-- que cada operação disponibiliza.
--
-- O trigger de UPDATE dispara em QUALQUER UPDATE (sem `OF coluna` — o
-- Postgres não permite combinar transition tables com column-specific
-- update triggers: "transition tables cannot be specified for triggers
-- with column lists"). Não é um problema: o filtro por
-- status='pago' em old_table/new_table já decide sozinho quais contas
-- merecem recálculo, então isso também fecha o gap de conta_id/valor/
-- tipo/datas (§9.53) sem precisar enumerar colunas — qualquer UPDATE que
-- toque uma linha paga (antes ou depois) é pego, não só as que mudam
-- exatamente essas colunas.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.atualizar_saldo_conta_lote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_conta_id uuid;
BEGIN
  -- ORDER BY conta_id em todos os 3 loops (não só o de UPDATE): duas
  -- operações em lote concorrentes tocando as MESMAS contas em ordens
  -- diferentes (SELECT DISTINCT sozinho não garante ordem nenhuma) podiam
  -- travar uma na outra — cada _fin_recalcular_saldo_conta_raw retém o
  -- lock da conta até commitar, então uma pega A e espera B enquanto a
  -- outra pega B e espera A. Mesma ordem determinística já usada em
  -- fin_criar_transferencia (achado do /code-review).
  IF TG_OP = 'INSERT' THEN
    FOR v_conta_id IN
      SELECT DISTINCT conta_id FROM new_table WHERE status = 'pago' AND conta_id IS NOT NULL
       ORDER BY conta_id
    LOOP
      PERFORM public._fin_recalcular_saldo_conta_raw(v_conta_id);
    END LOOP;
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    FOR v_conta_id IN
      SELECT DISTINCT conta_id FROM old_table WHERE status = 'pago' AND conta_id IS NOT NULL
       ORDER BY conta_id
    LOOP
      PERFORM public._fin_recalcular_saldo_conta_raw(v_conta_id);
    END LOOP;
    RETURN NULL;
  END IF;

  -- TG_OP = 'UPDATE': uma linha pode ter mudado de conta_id (o.conta_id
  -- diferente de n.conta_id) — recalcula a conta ANTIGA e a NOVA sempre
  -- que qualquer uma das duas pontas envolver status='pago'.
  FOR v_conta_id IN
    SELECT DISTINCT conta_id FROM (
      SELECT conta_id FROM old_table WHERE status = 'pago'
      UNION
      SELECT conta_id FROM new_table WHERE status = 'pago'
    ) afetadas
    WHERE conta_id IS NOT NULL
    ORDER BY conta_id
  LOOP
    PERFORM public._fin_recalcular_saldo_conta_raw(v_conta_id);
  END LOOP;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_atualizar_saldo_conta ON public.transacoes_financeiras;

CREATE TRIGGER trigger_atualizar_saldo_conta_insert
  AFTER INSERT ON public.transacoes_financeiras
  REFERENCING NEW TABLE AS new_table
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.atualizar_saldo_conta_lote();

CREATE TRIGGER trigger_atualizar_saldo_conta_delete
  AFTER DELETE ON public.transacoes_financeiras
  REFERENCING OLD TABLE AS old_table
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.atualizar_saldo_conta_lote();

CREATE TRIGGER trigger_atualizar_saldo_conta_update
  AFTER UPDATE ON public.transacoes_financeiras
  REFERENCING OLD TABLE AS old_table NEW TABLE AS new_table
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.atualizar_saldo_conta_lote();

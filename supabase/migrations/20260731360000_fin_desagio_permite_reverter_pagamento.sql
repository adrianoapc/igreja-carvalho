-- ============================================================================
-- 1 achado do /code-review (PR #67, rodada de 02/08 16:34, commit revisado
-- c8a0f17d), real:
--
-- `proteger_desagio_vinculado` (trigger BEFORE UPDATE) bloqueia editar
-- `data_pagamento` (entre outros campos) enquanto o deságio ainda está
-- vinculado a um lote — E a própria mensagem de erro orienta o usuário a
-- "marcar como pendente antes (desvincula o lote) pra poder editar".
-- Só que "Reverter pagamento" (`fin_alterar_status_lancamento`,
-- p_novo_status='pendente') faz exatamente isso NUMA SÓ statement:
-- `UPDATE ... SET status = 'pendente', data_pagamento = NULL, ...` — muda
-- `status` E `data_pagamento` JUNTOS. O guard atual não distingue "editar
-- data_pagamento enquanto status fica igual" (deve bloquear — é o caso
-- real que a proteção existe pra evitar) de "data_pagamento sendo limpo
-- COMO CONSEQUÊNCIA do status voltar de pago pra não-pago" (deve ser
-- permitido — é o próprio caminho de desvincular que a mensagem de erro
-- recomenda). Resultado: a orientação da própria mensagem de erro não
-- funciona — `FIN_DESAGIO_VINCULADO` dispara de novo tentando seguir ela.
--
-- Pior: `proteger_desagio_vinculado` é `BEFORE UPDATE`, e quem realmente
-- desvincula o lote (`sincronizar_lote_antecipacao_ao_reverter_desagio`,
-- 20260731180000) é `AFTER UPDATE OF status` — a exceção do trigger BEFORE
-- aborta a `UPDATE` inteira antes do trigger AFTER sequer rodar. O
-- "Reverter pagamento" de um deságio vinculado ficava impossível de fazer
-- pela UI normal.
--
-- Fix: a checagem de `data_pagamento` só bloqueia quando ele muda SEM o
-- `status` também estar saindo de 'pago' — isto é, `data_pagamento`
-- virando `NULL` junto com `status` deixando de ser 'pago' (a assinatura
-- exata de "Reverter pagamento") passa a ser permitido; qualquer outra
-- mudança de `data_pagamento` (com `status` igual, ou virando algo que
-- não é `NULL`) continua bloqueada como antes.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.proteger_desagio_vinculado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_lote_id uuid;
BEGIN
  IF OLD.origem_registro IS DISTINCT FROM 'getnet_antecipacao_desagio' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_lote_id FROM public.getnet_antecipacao_lotes
   WHERE lancamento_desagio_id = OLD.id;

  -- Reativar uma linha órfã (sem lote referenciando-a mais).
  IF NEW.status = 'pago' AND OLD.status <> 'pago' AND v_lote_id IS NULL THEN
    RAISE EXCEPTION 'FIN_DESAGIO_ORFAO: este lançamento era o deságio de um lote de antecipação Getnet cujo vínculo já foi desfeito (revertido antes) — não pode ser marcado como pago de novo, senão o deságio seria contado duas vezes. Lance um novo deságio pelo lote em Reconciliação Bancária > Lotes de Antecipação.';
  END IF;

  -- Editar valor/conta/tipo/data/filial enquanto AINDA vinculada a um
  -- lote. Status muda sozinho é permitido (é o caminho de reverter/
  -- desvincular, tratado pelo trigger AFTER sincronizar_lote_
  -- antecipacao_ao_reverter_desagio). `data_pagamento` tem uma exceção
  -- própria: virar NULL enquanto `status` também sai de 'pago' é a
  -- ASSINATURA de "Reverter pagamento" (fin_alterar_status_lancamento),
  -- que muda os dois campos juntos numa statement só — bloquear isso
  -- tornava a própria orientação da mensagem de erro abaixo ("marque como
  -- pendente antes") impossível de seguir, porque o BEFORE trigger
  -- abortava a UPDATE antes do AFTER trigger desvincular o lote (achado
  -- do /code-review). Qualquer OUTRA mudança de data_pagamento (status
  -- igual, ou data_pagamento virando algo que não é NULL) continua
  -- bloqueada.
  IF v_lote_id IS NOT NULL AND (
       NEW.valor IS DISTINCT FROM OLD.valor
    OR NEW.valor_liquido IS DISTINCT FROM OLD.valor_liquido
    OR NEW.conta_id IS DISTINCT FROM OLD.conta_id
    OR NEW.tipo IS DISTINCT FROM OLD.tipo
    OR NEW.filial_id IS DISTINCT FROM OLD.filial_id
    OR NEW.data_vencimento IS DISTINCT FROM OLD.data_vencimento
    OR NEW.data_competencia IS DISTINCT FROM OLD.data_competencia
    OR (NEW.data_pagamento IS DISTINCT FROM OLD.data_pagamento
        AND NOT (NEW.data_pagamento IS NULL
                 AND OLD.status = 'pago'
                 AND NEW.status IS DISTINCT FROM OLD.status))
  ) THEN
    RAISE EXCEPTION 'FIN_DESAGIO_VINCULADO: este lançamento é o deságio do lote % de antecipação Getnet, ainda vinculado — valor, conta, tipo, filial e datas não podem ser editados enquanto vinculado, pra não divergir do deságio calculado a partir do contrato/extrato. Marque como pendente antes (desvincula o lote) pra poder editar, ou exclua e relance.', v_lote_id;
  END IF;

  RETURN NEW;
END;
$function$;

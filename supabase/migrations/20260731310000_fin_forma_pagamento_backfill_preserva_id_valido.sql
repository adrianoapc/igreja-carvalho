-- ============================================================================
-- 1 achado do /code-review (PR #67, rodada de 02/08 02:41, commit revisado
-- 13f60b8f), real — regressão no meu próprio backfill corretivo de §9.61:
--
-- O backfill corretivo (20260731220000, item 3) reprocessava TODA linha
-- com `forma_pagamento` (texto) preenchido, comparando o candidato
-- resolvido por RÓTULO+FILIAL contra o `forma_pagamento_id` já gravado, e
-- sobrescrevia sempre que os dois divergiam — mesmo quando o `forma_
-- pagamento_id` atual já era PERFEITAMENTE VÁLIDO (mesma filial ou
-- global). Dois cenários reais quebravam por causa disso:
--
-- 1) Forma renomeada depois que a transação foi criada — `forma_
--    pagamento_id` aponta pra um id correto, mas `formas_pagamento.nome`
--    hoje é diferente do texto legado gravado na transação (`t.forma_
--    pagamento`, capturado no momento da transação). A busca por
--    `lower(fp.nome) = lower(t.forma_pagamento)` não acha mais nenhum
--    candidato (nome mudou) — `melhor.forma_id` fica NULL — e o UPDATE
--    zera um `forma_pagamento_id` que era válido.
-- 2) Duas formas compatíveis com a mesma filial compartilhando o nome
--    histórico — a ordenação por `ativo DESC, created_at ASC` podia
--    escolher uma forma DIFERENTE da que estava corretamente gravada,
--    trocando um id válido por outro (também válido, mas não o
--    originalmente escolhido) sem nenhum motivo real pra trocar.
--
-- Fix: só re-resolve quando `forma_pagamento_id` está NULL (nunca
-- resolvido) OU quando o id atual está PROVADAMENTE incompatível
-- (aponta pra uma forma de uma filial ESPECÍFICA diferente da filial da
-- transação — o bug real que esse backfill existe pra corrigir). Nunca
-- mais sobrescreve um id que já é global ou já bate com a filial da
-- transação, mesmo que a resolução por rótulo hoje aponte pra outro
-- candidato.
-- ============================================================================

WITH melhor AS (
  SELECT t.id AS transacao_id,
         (SELECT fp.id
            FROM public.formas_pagamento fp
           WHERE fp.igreja_id = t.igreja_id
             AND lower(fp.nome) = lower(t.forma_pagamento)
             AND (fp.filial_id IS NOT DISTINCT FROM t.filial_id OR fp.filial_id IS NULL)
           ORDER BY (fp.filial_id IS NOT DISTINCT FROM t.filial_id) DESC, fp.ativo DESC, fp.created_at ASC
           LIMIT 1) AS forma_id
    FROM public.transacoes_financeiras t
   WHERE t.forma_pagamento IS NOT NULL
     AND t.forma_pagamento !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     AND (
       -- nunca resolvido ainda
       t.forma_pagamento_id IS NULL
       -- ou provadamente incompatível: aponta pra uma filial ESPECÍFICA
       -- diferente da da transação (o bug real, não "nome diferente hoje")
       OR EXISTS (
         SELECT 1 FROM public.formas_pagamento fp_atual
          WHERE fp_atual.id = t.forma_pagamento_id
            AND fp_atual.filial_id IS NOT NULL
            AND fp_atual.filial_id IS DISTINCT FROM t.filial_id
       )
     )
)
UPDATE public.transacoes_financeiras t
   SET forma_pagamento_id = melhor.forma_id
  FROM melhor
 WHERE melhor.transacao_id = t.id
   AND t.forma_pagamento_id IS DISTINCT FROM melhor.forma_id;

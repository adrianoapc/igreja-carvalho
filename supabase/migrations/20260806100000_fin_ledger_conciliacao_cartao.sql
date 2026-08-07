-- ============================================================================
-- Fase 7a — Conciliação Cartão Getnet: ledger unificado (só leitura).
--
-- Substitui a agregação client-side de 3 queries (Hop2 candidatos + Hop1
-- candidatos + tabela de lotes) por 1 RPC que já monta a cadeia inteira
-- Oferta → Venda → Banco (+ lotes de antecipação), pronta pro componente
-- `ConciliacaoCartaoLedger` (Fase 7b) renderizar 1 linha expansível por
-- oferta. Nenhuma escrita — as confirmações continuam via
-- fin_vincular_venda_getnet_oferta / fin_vincular_venda_banco_getnet /
-- fin_vincular_lote_antecipacao / fin_lancar_desagio_antecipacao,
-- inalteradas.
--
-- Vocabulário de status do LANÇAMENTO — deliberadamente diferente do enum de
-- getnet_antecipacao_lotes.status (pendente_vinculo/vinculado/
-- lancamento_criado): sem_hop2 / aguardando_banco / fechado / divergencia.
-- `antecipada` só existe em escopo de PARCELA (hop1_status), nunca vira
-- status de linha.
--
-- Papel de p_conta_id: Hop 2 (oferta↔venda) independe de conta — só entra a
-- partir do Hop 1. `lancamentos` é filtrado por
-- transacoes_financeiras.conta_id = p_conta_id (mesmo filtro de
-- fin_conferencia_totais_getnet). `lotes` já vinculados a um extrato só
-- aparecem se esse extrato é da conta pedida; lotes AINDA sem extrato
-- (pendente_vinculo) não têm conta associada — continuam aparecendo
-- independente de p_conta_id (é exatamente a lista que a ação "Vincular
-- extrato" precisa enxergar, e LotesAntecipacaoTab hoje já lista sem escopo
-- de conta pro mesmo caso).
--
-- Papel de p_integracao_id: escopo do EC Getnet. Recebíveis, lotes e
-- vendas_origem filtram por integracao_id = p_integracao_id (mesma regra
-- dos candidatos Hop 1/2) — igreja com 2 CNPJs não mistura cadeias.
--
-- Extrato do lote: LEFT JOIN extratos_bancarios só devolve
-- credito_banco/data_liquidacao quando has_filial_access no extrato
-- (lote global + extrato de outra filial não vaza valor — §9.78/§9.79).
--
-- Sugestões Hop 2: 1 chamada de fin_gerar_candidatos_oferta_venda_getnet por
-- período inteiro (contexto repassado, nunca NULL), join único nos
-- lançamentos sem_hop2 por transacao_id (DISTINCT ON transacao_id ORDER BY
-- score DESC — nunca 1 chamada por linha, nunca multiplica linha do
-- lançamento).
--
-- Override de divergência: soma valor_liquido de TODO getnet_recebivel_
-- lancamentos do EC (integracao_id) apontando pro mesmo extrato_bancario_id
-- (não só o subconjunto deste grupo) vs extratos_bancarios.valor — mesma
-- agregação que fin_vincular_venda_banco_getnet já fez ao escrever esse
-- vínculo (Hop 1 agrupa por data_vencimento, não por lançamento; um crédito
-- pode cobrir parcelas de mais de uma oferta do mesmo dia). Tolerância
-- R$0,01 (CENTAVOS_TOLERANCIA, mesma constante de
-- ConferenciaTotaisGetnetCard.tsx).
-- Gate de vazamento = has_filial_access no extrato (eb), mesmo padrão de
-- lotes_final: sem acesso à filial do extrato, a linha não vira
-- "divergencia". A soma g2 NÃO filtra HFA por recebível — com âncora
-- compartilhada (#13: extrato global + recebíveis de filiais distintas) a
-- conta precisa ser completa vs eb.valor; filtrar g2 por HFA gerava
-- divergencia falsa (Bugbot "Partial sum versus full extrato", review #83).
-- g2 não é devolvido linha a linha — só alimenta o bit de status.
--
-- Double-count do CSV: valor_venda repete o bruto por parcela do mesmo NSU —
-- nunca usado aqui. Parcelas/vendas_origem usam
-- COALESCE(valor_liquido_parcela, valor_liquido, valor_parcela−descontos).
--
-- Status fechado: n_batidas = n_recebiveis AND n_recebiveis >= n_membros —
-- evita marcar fechado com Hop 2 incompleto (parcelas-filhas sem recebível).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fin_listar_ledger_conciliacao_cartao(
  p_integracao_id uuid,
  p_conta_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date,
  p_contexto jsonb DEFAULT NULL,
  p_filial_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_integracao record;
  v_conta record;
  v_scope uuid;
  v_resultado jsonb;
BEGIN
  IF p_integracao_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_integracao_id é obrigatório';
  END IF;
  IF p_conta_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_conta_id é obrigatório';
  END IF;
  IF p_periodo_inicio IS NULL OR p_periodo_fim IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_periodo_inicio e p_periodo_fim são obrigatórios';
  END IF;
  IF p_periodo_fim < p_periodo_inicio THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_periodo_fim anterior a p_periodo_inicio';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;

  SELECT i.id, i.igreja_id, i.filial_id, i.provedor
    INTO v_integracao
    FROM public.integracoes_financeiras i
   WHERE i.id = p_integracao_id;

  IF v_integracao.id IS NULL OR v_integracao.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: integração inexistente ou fora do tenant';
  END IF;
  IF v_integracao.provedor IS DISTINCT FROM 'getnet' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: integração % não é do provedor getnet', p_integracao_id;
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_integracao.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da integração';
  END IF;

  SELECT c.id, c.igreja_id, c.filial_id
    INTO v_conta
    FROM public.contas c
   WHERE c.id = p_conta_id;

  IF v_conta.id IS NULL OR v_conta.igreja_id IS DISTINCT FROM v_igreja THEN
    RAISE EXCEPTION 'FIN_FK: conta inexistente ou fora do tenant';
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_conta.filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta';
  END IF;

  IF p_filial_id IS NOT NULL THEN
    IF NOT public.has_filial_access(v_igreja, p_filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial solicitada';
    END IF;
    v_scope := p_filial_id;
  ELSE
    v_scope := NULL;
  END IF;

  WITH
  -- ─── Raízes de grupo (não-dividido ou parcela 1/N pós Fase 2b) ───────────
  raizes AS (
    SELECT
      t.id,
      t.descricao AS trx_descricao,
      t.data_vencimento,
      t.filial_id,
      t.valor,
      t.numero_parcela,
      t.total_parcelas,
      COALESCE(fp.nome, t.forma_pagamento) AS forma_desc
    FROM public.transacoes_financeiras t
    LEFT JOIN public.formas_pagamento fp ON fp.id = t.forma_pagamento_id
   WHERE t.igreja_id = v_igreja
     AND t.conta_id = p_conta_id
     AND t.tipo = 'entrada'
     AND t.status <> 'cancelado'
     AND t.lancamento_pai_id IS NULL
     AND t.data_vencimento BETWEEN p_periodo_inicio AND p_periodo_fim
     AND COALESCE(fp.nome, t.forma_pagamento, '') ILIKE '%cart%'
     AND public.has_filial_access(v_igreja, t.filial_id)
     AND (v_scope IS NULL OR t.filial_id IS NULL OR t.filial_id = v_scope)
  ),
  -- ─── Todo membro do grupo (raiz + filhas), 1 linha por lançamento ────────
  membros AS (
    SELECT r.id AS trans_id, r.id AS grupo_id, r.numero_parcela, r.total_parcelas, r.valor
      FROM raizes r
    UNION ALL
    SELECT f.id, f.lancamento_pai_id, f.numero_parcela, f.total_parcelas, f.valor
      FROM public.transacoes_financeiras f
     WHERE f.lancamento_pai_id IN (SELECT id FROM raizes)
       AND f.igreja_id = v_igreja
       AND f.status <> 'cancelado'
  ),
  grupo_agg AS (
    SELECT
      grupo_id,
      SUM(valor) AS valor_bruto,
      COUNT(*) AS n_membros,
      COUNT(*) FILTER (WHERE trans_id <> grupo_id) AS n_filhas
    FROM membros
    GROUP BY grupo_id
  ),
  -- ─── Recebíveis Getnet já casados (Hop 2 feito) com cada membro ──────────
  recebiveis_grupo AS (
    SELECT
      m.grupo_id,
      g.id AS recebivel_id,
      g.nsu,
      COALESCE(
        g.valor_liquido_parcela,
        g.valor_liquido,
        COALESCE(g.valor_parcela, g.valor_venda) - abs(COALESCE(g.descontos, 0))
      ) AS valor_liquido,
      g.data_vencimento AS data_vencimento_real,
      g.extrato_bancario_id,
      g.contrato_registradora,
      COALESCE(m.numero_parcela, 1) AS numero_parcela,
      COALESCE(m.total_parcelas, 1) AS total_parcelas
    FROM membros m
    JOIN public.getnet_recebivel_lancamentos g
      ON g.transacao_financeira_id = m.trans_id
     AND g.igreja_id = v_igreja
     AND g.integracao_id = p_integracao_id
     AND public.has_filial_access(v_igreja, g.filial_id)
  ),
  recebiveis_status AS (
    SELECT
      rg.*,
      CASE
        WHEN rg.extrato_bancario_id IS NOT NULL THEN 'fechado'
        WHEN rg.contrato_registradora IS NOT NULL
         AND EXISTS (
               SELECT 1 FROM public.getnet_antecipacao_lotes l
                WHERE l.igreja_id = v_igreja
                  AND l.integracao_id = p_integracao_id
                  AND l.contrato_registradora = rg.contrato_registradora
                  AND l.status IN ('vinculado', 'lancamento_criado')
                  AND public.has_filial_access(v_igreja, l.filial_id)
             ) THEN 'antecipada'
        ELSE 'aguardando'
      END AS hop1_status,
      (
        SELECT l.id FROM public.getnet_antecipacao_lotes l
         WHERE l.igreja_id = v_igreja
           AND l.integracao_id = p_integracao_id
           AND l.contrato_registradora = rg.contrato_registradora
           AND public.has_filial_access(v_igreja, l.filial_id)
      ) AS lote_id
    FROM recebiveis_grupo rg
  ),
  grupo_stats AS (
    SELECT
      grupo_id,
      COUNT(*) AS n_recebiveis,
      COUNT(*) FILTER (WHERE hop1_status IN ('fechado', 'antecipada')) AS n_batidas
    FROM recebiveis_status
    GROUP BY grupo_id
  ),
  -- ─── Divergência: soma completa do EC por extrato (Hop 1 agrupa por dia,
  -- não por lançamento — um crédito pode cobrir parcelas de mais de uma
  -- oferta). Gate = HFA no extrato (eb). Soma g2 NÃO filtra HFA: com âncora
  -- compartilhada (#13) a conta vs eb.valor tem que ser completa — HFA em
  -- g2 gerava divergencia falsa (Bugbot review #83). Escopo integracao_id
  -- no g2 pela mesma razão do resto do arquivo.
  divergencia_grupo AS (
    SELECT DISTINCT rs.grupo_id
    FROM recebiveis_status rs
    JOIN public.extratos_bancarios eb
      ON eb.id = rs.extrato_bancario_id
     AND public.has_filial_access(v_igreja, eb.filial_id)
   WHERE rs.extrato_bancario_id IS NOT NULL
     AND abs(
           (
             SELECT COALESCE(SUM(
                      COALESCE(
                        g2.valor_liquido_parcela,
                        g2.valor_liquido,
                        COALESCE(g2.valor_parcela, g2.valor_venda) - abs(COALESCE(g2.descontos, 0))
                      )
                    ), 0)
               FROM public.getnet_recebivel_lancamentos g2
              WHERE g2.extrato_bancario_id = rs.extrato_bancario_id
                AND g2.igreja_id = v_igreja
                AND g2.integracao_id = p_integracao_id
           ) - eb.valor
         ) > 0.01
  ),
  parcelas_agg AS (
    SELECT
      grupo_id,
      jsonb_agg(
        jsonb_build_object(
          'numero_parcela', numero_parcela,
          'total_parcelas', total_parcelas,
          'nsu', nsu,
          'valor_liquido', valor_liquido,
          'data_vencimento_real', data_vencimento_real,
          'hop1_status', hop1_status,
          'extrato_bancario_id', extrato_bancario_id,
          'lote_id', lote_id
        )
        ORDER BY numero_parcela, recebivel_id
      ) AS parcelas
    FROM recebiveis_status
    GROUP BY grupo_id
  ),
  -- ─── Sugestão Hop 2: 1 chamada pro período inteiro, join por transacao_id ─
  sugestoes AS (
    SELECT DISTINCT ON (c.transacao_id)
      c.transacao_id,
      c.recebivel_ids,
      c.score,
      c.features
    FROM public.fin_gerar_candidatos_oferta_venda_getnet(
           p_integracao_id, p_periodo_inicio, p_periodo_fim, v_ctx, v_scope
         ) c
   WHERE c.transacao_id IS NOT NULL
   ORDER BY c.transacao_id, c.score DESC
  ),
  lancamentos_montados AS (
    SELECT
      r.id AS grupo_id,
      r.forma_desc AS descricao,
      r.data_vencimento,
      r.filial_id,
      ga.valor_bruto,
      (COALESCE(ga.n_filhas, 0) > 0) AS parcelado,
      (COALESCE(ga.n_filhas, 0) + 1) AS total_parcelas,
      CASE
        WHEN COALESCE(gs.n_recebiveis, 0) = 0 THEN 'sem_hop2'
        WHEN r.id IN (SELECT grupo_id FROM divergencia_grupo) THEN 'divergencia'
        -- Exige cobrir todos os membros do grupo (raiz+filhas), não só os
        -- recebíveis já linkados — Hop 2 incompleto não vira "fechado".
        WHEN gs.n_batidas = gs.n_recebiveis
         AND gs.n_recebiveis >= ga.n_membros THEN 'fechado'
        ELSE 'aguardando_banco'
      END AS status,
      COALESCE(pa.parcelas, '[]'::jsonb) AS parcelas,
      CASE
        WHEN COALESCE(gs.n_recebiveis, 0) = 0 AND s.transacao_id IS NOT NULL THEN
          jsonb_build_object(
            'recebivel_ids', to_jsonb(s.recebivel_ids),
            'score', s.score,
            'features', s.features
          )
        ELSE NULL
      END AS sugestao
    FROM raizes r
    JOIN grupo_agg ga ON ga.grupo_id = r.id
    LEFT JOIN grupo_stats gs ON gs.grupo_id = r.id
    LEFT JOIN parcelas_agg pa ON pa.grupo_id = r.id
    LEFT JOIN sugestoes s ON s.transacao_id = r.id
  ),
  lancamentos_final AS (
    SELECT jsonb_agg(
             jsonb_build_object(
               'grupo_id', grupo_id,
               'descricao', descricao,
               'data_vencimento', data_vencimento,
               'filial_id', filial_id,
               'valor_bruto', valor_bruto,
               'parcelado', parcelado,
               'total_parcelas', total_parcelas,
               'status', status,
               'parcelas', parcelas,
               'sugestao', sugestao
             )
             ORDER BY data_vencimento, grupo_id
           ) AS arr,
           COUNT(*) FILTER (WHERE status = 'fechado') AS n_fechados,
           COUNT(*) FILTER (WHERE status = 'aguardando_banco') AS n_aguardando,
           COUNT(*) FILTER (WHERE status = 'sem_hop2') AS n_sem_hop2,
           COUNT(*) FILTER (WHERE status = 'divergencia') AS n_divergencia
      FROM lancamentos_montados
  ),
  -- ─── Lotes de antecipação do período (ou já tocados por vendas do período) ─
  lotes_candidatos AS (
    SELECT l.*
      FROM public.getnet_antecipacao_lotes l
     WHERE l.igreja_id = v_igreja
       AND l.integracao_id = p_integracao_id
       AND public.has_filial_access(v_igreja, l.filial_id)
       AND (v_scope IS NULL OR l.filial_id IS NULL OR l.filial_id = v_scope)
       AND (
             (l.data_contratacao_contrato BETWEEN p_periodo_inicio AND p_periodo_fim)
             OR EXISTS (
                  SELECT 1 FROM public.getnet_recebivel_lancamentos g
                   WHERE g.igreja_id = v_igreja
                     AND g.integracao_id = p_integracao_id
                     AND g.contrato_registradora = l.contrato_registradora
                     AND g.data_venda BETWEEN p_periodo_inicio AND p_periodo_fim
                )
           )
       -- Conta: lote já vinculado só entra se o extrato é desta conta; lote
       -- ainda pendente_vinculo (sem extrato) não tem conta própria — segue
       -- aparecendo pra permitir a ação "Vincular extrato" (mesmo
       -- comportamento sem escopo de conta que LotesAntecipacaoTab já tem
       -- hoje pra esse caso).
       AND (
             l.extrato_bancario_id IS NULL
             OR EXISTS (
                  SELECT 1 FROM public.extratos_bancarios eb
                   WHERE eb.id = l.extrato_bancario_id
                     AND eb.conta_id = p_conta_id
                )
           )
  ),
  vendas_origem_agg AS (
    SELECT
      lc.id AS lote_id,
      jsonb_agg(
        jsonb_build_object(
          'nsu', g.nsu,
          'valor_parcela_liquido', COALESCE(
            g.valor_liquido_parcela,
            g.valor_liquido,
            COALESCE(g.valor_parcela, g.valor_venda) - abs(COALESCE(g.descontos, 0))
          ),
          -- g.parcelas é `integer` (drift de schema fechado em
          -- 20260807100000; produção nunca teve o rótulo texto "N de M" —
          -- coluna 100% NULL nas linhas reais). Um integer isolado não
          -- permite reconstruir "parcela atual DE total" sem uma 2ª coluna
          -- que não existe — não tenta mais extrair via regex; cai direto
          -- no fallback 1, que é o comportamento real hoje (ot.numero_
          -- parcela/ot.total_parcelas de transacoes_financeiras seguem
          -- confiáveis quando a venda já tem oferta vinculada).
          'numero_parcela', COALESCE(ot.numero_parcela, 1),
          'total_parcelas', COALESCE(ot.total_parcelas, 1),
          -- Sem HFA na oferta: nullar metadados (não vazar descrição/data
          -- de filial inacessível via recebível global).
          'oferta_lancamento_id', CASE
            WHEN ot.id IS NULL THEN NULL
            WHEN public.has_filial_access(v_igreja, ot.filial_id) THEN ot.id
            ELSE NULL
          END,
          'oferta_descricao', CASE
            WHEN ot.id IS NOT NULL AND public.has_filial_access(v_igreja, ot.filial_id)
              THEN ot.descricao
            ELSE NULL
          END,
          'oferta_data_vencimento', CASE
            WHEN ot.id IS NOT NULL AND public.has_filial_access(v_igreja, ot.filial_id)
              THEN ot.data_vencimento
            ELSE NULL
          END
        )
        ORDER BY g.data_venda, g.id
      ) AS vendas_origem
    FROM lotes_candidatos lc
    JOIN public.getnet_recebivel_lancamentos g
      ON g.igreja_id = v_igreja
     AND g.integracao_id = p_integracao_id
     AND g.contrato_registradora = lc.contrato_registradora
     AND public.has_filial_access(v_igreja, g.filial_id)
    LEFT JOIN public.transacoes_financeiras ot ON ot.id = g.transacao_financeira_id
    GROUP BY lc.id
  ),
  lotes_final AS (
    SELECT jsonb_agg(
             jsonb_build_object(
               'lote_id', lc.id,
               'contrato_registradora', lc.contrato_registradora,
               'status', lc.status,
               'filial_id', lc.filial_id,
               'valor_contrato', lc.valor_atual_contrato,
               'desagio', CASE WHEN eb.id IS NOT NULL THEN lc.valor_atual_contrato - eb.valor ELSE NULL END,
               'credito_banco', eb.valor,
               'data_liquidacao', eb.data_transacao,
               'vendas_origem', COALESCE(voa.vendas_origem, '[]'::jsonb)
             )
             ORDER BY lc.data_contratacao_contrato NULLS LAST, lc.id
           ) AS arr
      FROM lotes_candidatos lc
      -- HFA no extrato: lote global + extrato de outra filial não vaza
      -- credito_banco/data_liquidacao (review #83 / §9.78).
      LEFT JOIN public.extratos_bancarios eb
        ON eb.id = lc.extrato_bancario_id
       AND public.has_filial_access(v_igreja, eb.filial_id)
      LEFT JOIN vendas_origem_agg voa ON voa.lote_id = lc.id
  )
  SELECT jsonb_build_object(
           'resumo', jsonb_build_object(
             'fechados', COALESCE(lf.n_fechados, 0),
             'aguardando_banco', COALESCE(lf.n_aguardando, 0),
             'sem_hop2', COALESCE(lf.n_sem_hop2, 0),
             'divergencia', COALESCE(lf.n_divergencia, 0)
           ),
           'lancamentos', COALESCE(lf.arr, '[]'::jsonb),
           'lotes', COALESCE(lotf.arr, '[]'::jsonb)
         )
    INTO v_resultado
    FROM lancamentos_final lf
    FULL OUTER JOIN lotes_final lotf ON true;

  RETURN COALESCE(
    v_resultado,
    jsonb_build_object(
      'resumo', jsonb_build_object('fechados', 0, 'aguardando_banco', 0, 'sem_hop2', 0, 'divergencia', 0),
      'lancamentos', '[]'::jsonb,
      'lotes', '[]'::jsonb
    )
  );
END;
$$;

COMMENT ON FUNCTION public.fin_listar_ledger_conciliacao_cartao(uuid, uuid, date, date, jsonb, uuid) IS
  'Fase 7a Conciliação Cartão Getnet (só leitura): monta o ledger unificado Oferta→Venda→Banco + lotes de antecipação por período. Status de linha (sem_hop2/aguardando_banco/fechado/divergencia) deliberadamente distinto do enum getnet_antecipacao_lotes.status. Sugestão Hop 2 via 1 chamada de fin_gerar_candidatos_oferta_venda_getnet por período (join único por transacao_id, DISTINCT ON score DESC). Divergência = Σ valor_liquido do EC por extrato vs extratos_bancarios.valor, tol. R$0,01; gate has_filial_access só no extrato (eb) — soma g2 completa (igreja+integracao, sem HFA por recebível) pra não gerar divergencia falsa com âncora compartilhada #13 (review #83). lancamentos escopados por transacoes_financeiras.conta_id = p_conta_id; recebíveis/lotes/vendas_origem por integracao_id = p_integracao_id; lotes vinculados só entram se o extrato é da mesma conta, lotes pendente_vinculo aparecem sem escopo de conta. Extrato do lote e metadados de oferta em vendas_origem exigem has_filial_access. fechado exige n_batidas = n_recebiveis >= n_membros.';

GRANT EXECUTE ON FUNCTION public.fin_listar_ledger_conciliacao_cartao(uuid, uuid, date, date, jsonb, uuid)
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_listar_ledger_conciliacao_cartao(uuid, uuid, date, date, jsonb, uuid)
  FROM anon;

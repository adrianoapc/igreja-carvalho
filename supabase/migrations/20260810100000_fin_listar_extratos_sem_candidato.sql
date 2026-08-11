-- ============================================================================
-- Modo Clássico como estado derivado (Ciclo 2, C2-1)
--
-- `fin_listar_extratos_sem_candidato` — extratos_bancarios pendentes que
-- SOBRARAM depois que os motores Cartão (Getnet) e Inteligente (F4, ADR-030)
-- já tentaram. Hoje `ConciliacaoManual`/`useConciliacaoManualData` lista TODO
-- extrato com reconciliado=false + transacao_vinculada_id IS NULL, sem excluir
-- o que os outros dois motores já estão tratando.
--
-- Reaproveita `fin_gerar_candidatos_conciliacao` (F4) inteira, como função de
-- tabela — mesma resolução de contexto/filial/corte de score, sem duplicar a
-- CTE de scoring nem o threshold (só existe um lugar que decide "tem
-- candidato": a própria fin_gerar_candidatos_conciliacao).
--
-- Exclusão do motor Cartão: um extrato confirmado como Hop 1
-- (`getnet_recebivel_lancamentos.extrato_bancario_id`) já sai da lista
-- sozinho, porque `fin_vincular_venda_banco_getnet` marca reconciliado=true.
-- Mas um extrato vinculado a um lote de antecipação
-- (`getnet_antecipacao_lotes.extrato_bancario_id`) NÃO marca reconciliado
-- (decisão histórica documentada em 20260805130000) — sem exclusão explícita,
-- continuaria aparecendo aqui mesmo já "tomado" pelo Cartão. Esse é o overlap
-- real que motivou esta RPC (achado da investigação C2-1).
--
-- Escopo consciente: candidatos do Cartão AINDA NÃO confirmados (sugestão em
-- `fin_gerar_candidatos_venda_banco_getnet`, que exige conta_id+integracao_id
-- específicos) não são excluídos aqui — cruzar isso exigiria rodar essa RPC
-- Getnet para cada combinação conta×integração presente no período, escopo
-- maior que o achado concreto que motivou esta fase. Registrado como limite
-- conhecido, não como pendência esquecida.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fin_listar_extratos_sem_candidato(
  p_conta_id uuid DEFAULT NULL,
  p_periodo_inicio date DEFAULT NULL,
  p_periodo_fim date DEFAULT NULL,
  p_score_minimo numeric DEFAULT NULL,
  p_filial_id uuid DEFAULT NULL,
  p_contexto jsonb DEFAULT NULL
)
RETURNS TABLE(
  extrato_id uuid,
  data_transacao date,
  descricao text,
  valor numeric,
  tipo text,
  conta_id uuid,
  origem text,
  possivel_duplicata_de uuid,
  motivo text
)
LANGUAGE plpgsql
-- Sem STABLE: chama fin_gerar_candidatos_conciliacao, que não declara
-- volatilidade (default VOLATILE) — marcar STABLE aqui seria um contrato
-- inexato com a chamadora. Achado do code-review da C2-1.
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_filial uuid;
  v_scope uuid;
  v_pode_todas boolean;
  v_ini date;
  v_fim date;
BEGIN
  -- Mesma resolução de tenant/ator/filial que fin_gerar_candidatos_conciliacao
  -- (F4) — precisa bater exatamente, senão "sem candidato aqui" poderia
  -- divergir do que a tela Inteligente calcula pro mesmo extrato.
  v_ctx := public.fin_resolver_contexto(p_contexto, NULL);
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_filial := NULLIF(v_ctx ->> 'filial_id', '')::uuid;

  v_pode_todas := auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.role::text IN ('admin', 'admin_igreja', 'super_admin')
       AND (ur.igreja_id = v_igreja OR ur.igreja_id IS NULL)
  );
  IF p_filial_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.filiais f
       WHERE f.id = p_filial_id AND f.igreja_id = v_igreja
    ) THEN
      RAISE EXCEPTION 'FIN_TENANT: filial fora do tenant';
    END IF;
    IF NOT (v_pode_todas OR p_filial_id = v_filial) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial informada';
    END IF;
    v_scope := p_filial_id;
  ELSIF v_pode_todas THEN
    v_scope := NULL;
  ELSE
    v_scope := v_filial;
  END IF;

  v_ini := COALESCE(p_periodo_inicio, date_trunc('month', CURRENT_DATE)::date);
  v_fim := COALESCE(p_periodo_fim, (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date);

  RETURN QUERY
  WITH candidatos AS (
    -- Chama a F4 inteira como função de tabela — mesmo p_contexto/p_score_minimo,
    -- resolve corte e candidatos sozinha, sem duplicação.
    SELECT DISTINCT c.extrato_id
    FROM public.fin_gerar_candidatos_conciliacao(
      p_conta_id, v_ini, v_fim, p_score_minimo, p_filial_id, p_contexto
    ) c
  )
  SELECT
    e.id,
    e.data_transacao,
    e.descricao,
    e.valor,
    e.tipo,
    e.conta_id,
    e.origem,
    e.possivel_duplicata_de,
    CASE
      WHEN e.origem ILIKE '%getnet%' THEN 'venda_getnet_sem_vinculo_confirmado'
      ELSE 'sem_transacao_compativel_no_periodo'
    END AS motivo
  FROM public.extratos_bancarios e
  WHERE
    e.igreja_id = v_igreja
    -- Filial compartilhada (filial_id IS NULL) precisa continuar visível com
    -- filial concreta selecionada — RPC de LEITURA (guardrail financeiro:
    -- ".eq() puro" só se justifica quando o objetivo é travar escrita fora
    -- do escopo, não aqui). Achado do code-review da C2-1.
    AND (v_scope IS NULL OR e.filial_id = v_scope OR e.filial_id IS NULL)
    AND (p_conta_id IS NULL OR e.conta_id = p_conta_id)
    AND e.reconciliado = false
    AND e.transacao_vinculada_id IS NULL
    AND e.data_transacao BETWEEN v_ini AND v_fim
    AND NOT EXISTS (SELECT 1 FROM candidatos ca WHERE ca.extrato_id = e.id)
    -- Confirmado pelo motor Cartão (lote de antecipação) — não marca
    -- reconciliado, então precisa de exclusão explícita (achado C2-1).
    AND NOT EXISTS (
      SELECT 1 FROM public.getnet_antecipacao_lotes gal
       WHERE gal.extrato_bancario_id = e.id
    )
  ORDER BY e.data_transacao DESC;
END;
$$;

COMMENT ON FUNCTION public.fin_listar_extratos_sem_candidato(uuid, date, date, numeric, uuid, jsonb) IS
  'Extratos pendentes que sobraram depois dos motores Cartão (Getnet) e Inteligente (F4) — base do Modo Clássico como estado derivado (Ciclo 2, C2-1). Reaproveita fin_gerar_candidatos_conciliacao como função de tabela; exclui vínculo confirmado em getnet_antecipacao_lotes (não coberto por reconciliado=true).';

GRANT EXECUTE ON FUNCTION public.fin_listar_extratos_sem_candidato(uuid, date, date, numeric, uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_listar_extratos_sem_candidato(uuid, date, date, numeric, uuid, jsonb) FROM anon;

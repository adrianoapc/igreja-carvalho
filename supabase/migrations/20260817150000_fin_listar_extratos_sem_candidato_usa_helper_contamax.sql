-- ============================================================================
-- fin_listar_extratos_sem_candidato passa a chamar fin_e_movimentacao_
-- contamax (20260817140000) em vez de manter sua própria cópia do
-- heurístico `descricao ILIKE '%CONTAMAX%'` no CASE do motivo.
--
-- Achado (múltiplas rodadas do /code-review local, mesmo apontamento):
-- a mesma checagem de texto vivia duplicada em 2 migrations independentes
-- — a classificação de motivo (20260817120000) e a exclusão de candidatos
-- (20260817140000, que já centralizou a checagem num helper justamente pra
-- não duplicar). Sem esta migration, um refinamento futuro do padrão
-- ContaMax feito só no helper deixaria as duas classificações divergirem:
-- um extrato passaria a ser excluído do pool de candidatos mas continuaria
-- rotulado `sem_transacao_compativel_no_periodo` em vez de
-- `aplicacao_financeira_automatica` na tela do Modo Clássico.
--
-- Resto da função inalterado — só a linha do CASE muda.
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
      WHEN e.descricao ILIKE 'TARIFA%' THEN 'tarifa_bancaria_sem_lancamento'
      -- Fonte única com fin_gerar_candidatos_conciliacao (20260817140000) —
      -- não mais uma 2ª cópia do ILIKE '%CONTAMAX%'.
      WHEN public.fin_e_movimentacao_contamax(e.descricao) THEN 'aplicacao_financeira_automatica'
      WHEN e.descricao ILIKE '%CHEQUE%' THEN 'cheque_sem_lancamento_correspondente'
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
    -- Achado pré-C2-8 (20260812140000): o espelho sintético do próprio
    -- Getnet nunca vai ter um candidato F4 (não é crédito/débito bancário
    -- real), então sempre apareceria aqui como falsa tarefa pendente.
    -- Guarda de NULL: NOT fin_e_espelho_getnet(NULL) é NULL, não TRUE —
    -- sem o `origem IS NULL OR`, um extrato real com origem NULL sumiria
    -- desta lista silenciosamente.
    AND (e.origem IS NULL OR NOT public.fin_e_espelho_getnet(e.origem))
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
  'Extratos pendentes que sobraram depois dos motores Cartão (Getnet) e Inteligente (F4) — base do Modo Clássico como estado derivado (Ciclo 2, C2-1). Reaproveita fin_gerar_candidatos_conciliacao como função de tabela; exclui vínculo confirmado em getnet_antecipacao_lotes (não coberto por reconciliado=true) e origem espelho Getnet (achado pré-C2-8). Motivo distingue Getnet/tarifa bancária/aplicação automática (ContaMax, via fin_e_movimentacao_contamax — fonte única com o motor de candidatos)/cheque/genérico (20260817).';

GRANT EXECUTE ON FUNCTION public.fin_listar_extratos_sem_candidato(uuid, date, date, numeric, uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_listar_extratos_sem_candidato(uuid, date, date, numeric, uuid, jsonb) FROM anon;

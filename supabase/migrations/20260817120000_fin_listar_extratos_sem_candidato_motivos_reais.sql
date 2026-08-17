-- ============================================================================
-- Modo Clássico — motivos reais além do genérico (Ciclo 2, C2-1 follow-up)
--
-- `fin_listar_extratos_sem_candidato` só distinguia "parece Getnet" de
-- "sem transação compatível" — todo o resto do Modo Clássico caía no motivo
-- genérico, misturando lançamento realmente esquecido pelo tesoureiro com
-- movimentação que NUNCA vai ter uma transação correspondente.
--
-- Base: versão de 20260812140000 (fin_motor_conciliacao_exclui_espelho_
-- getnet), a mais recente — inclui a exclusão do espelho Getnet
-- (`e.origem IS NULL OR NOT fin_e_espelho_getnet(e.origem)`) que
-- 20260810100000 (versão original) não tinha. Preservada sem alteração;
-- só o CASE do motivo muda nesta migration.
--
-- Padrões confirmados em produção (consulta real via `supabase db query
-- --linked` antes desta migration, não suposição por analogia ao mockup
-- "Conciliação Cartão — proposta de tela", cujos exemplos de motivo são
-- ilustrativos, não dados reais):
--   - "TARIFA %" — tarifa bancária (mensalidade de pacote de serviços,
--     envio de Pix avulso etc.), 14 pendentes reais no momento da consulta.
--   - "%CONTAMAX%" — aplicação/resgate automático do banco (ida e volta de
--     caixa excedente pra um fundo, sem nenhuma ação do tesoureiro) — maior
--     fonte de ruído do Modo Clássico hoje (165 de 910 extratos pendentes,
--     ~18%, R$ 328 mil).
--   - "%CHEQUE%" — cheque depositado/devolvido, baixo volume (3 pendentes)
--     mas caso real, não hipotético.
--
-- "Transferência entre contas" cotada no mockup original NÃO tem padrão
-- real equivalente nos dados de produção — não adicionado (evita motivo
-- morto que nunca dispara).
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
      WHEN e.descricao ILIKE '%CONTAMAX%' THEN 'aplicacao_financeira_automatica'
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
  'Extratos pendentes que sobraram depois dos motores Cartão (Getnet) e Inteligente (F4) — base do Modo Clássico como estado derivado (Ciclo 2, C2-1). Reaproveita fin_gerar_candidatos_conciliacao como função de tabela; exclui vínculo confirmado em getnet_antecipacao_lotes (não coberto por reconciliado=true) e origem espelho Getnet (achado pré-C2-8). Motivo distingue Getnet/tarifa bancária/aplicação automática (ContaMax)/cheque/genérico (20260817, padrões confirmados em produção).';

GRANT EXECUTE ON FUNCTION public.fin_listar_extratos_sem_candidato(uuid, date, date, numeric, uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_listar_extratos_sem_candidato(uuid, date, date, numeric, uuid, jsonb) FROM anon;

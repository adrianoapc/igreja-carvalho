-- ============================================================================
-- Ciclo 2 (C2-5) — RPC de leitura pros campos de participante (tipo5/6)
--
-- Sem esta RPC, participante_cnpj_cpf/participante_razao_social/etc.
-- (migration `20260812100000`) ficariam capturados e nunca lidos por
-- nenhuma tela/RPC — mesmo anti-padrão que motivou a C2-4. Como
-- `getnet_financeiro_resumo`/`getnet_financeiro_detalhe` estão VAZIAS em
-- produção hoje (nenhuma linha tipo5/6 recebida ainda), não faz sentido
-- construir uma tela nova pra exibir zero linhas — esta RPC de busca por
-- `numero_operacao` é o ponto de consulta mínimo, pensado pra ser
-- reaproveitado pela C2-10 (validação numeroOperacao ×
-- contrato_registradora, bloqueada por evento AC real) quando ela
-- destravar, em vez de nascer uma segunda RPC equivalente na hora.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fin_buscar_financeiro_participante_getnet(
  p_integracao_id uuid,
  p_numero_operacao text,
  p_contexto jsonb DEFAULT NULL
)
RETURNS TABLE(
  origem text,
  numero_operacao text,
  chave_ur text,
  data_operacao date,
  participante_cnpj_cpf text,
  participante_razao_social text,
  participante_banco text,
  participante_agencia text,
  participante_conta_corrente text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_integracao record;
BEGIN
  IF p_integracao_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_integracao_id é obrigatório';
  END IF;
  IF p_numero_operacao IS NULL OR btrim(p_numero_operacao) = '' THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_numero_operacao é obrigatório';
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

  RETURN QUERY
  SELECT
    'resumo'::text,
    r.numero_operacao,
    r.chave_ur,
    r.data_operacao,
    r.participante_cnpj_cpf,
    r.participante_razao_social,
    r.participante_banco,
    r.participante_agencia,
    r.participante_conta_corrente
  FROM public.getnet_financeiro_resumo r
  WHERE r.igreja_id = v_igreja
    AND r.integracao_id = p_integracao_id
    AND r.numero_operacao = p_numero_operacao

  UNION ALL

  SELECT
    'detalhe'::text,
    d.numero_operacao,
    d.chave_ur,
    d.data_operacao,
    d.participante_cnpj_cpf,
    d.participante_razao_social,
    NULL::text,
    NULL::text,
    NULL::text
  FROM public.getnet_financeiro_detalhe d
  WHERE d.igreja_id = v_igreja
    AND d.integracao_id = p_integracao_id
    AND d.numero_operacao = p_numero_operacao;
END;
$$;

COMMENT ON FUNCTION public.fin_buscar_financeiro_participante_getnet(uuid, text, jsonb) IS
  'Busca por numero_operacao em getnet_financeiro_resumo (tipo5) + getnet_financeiro_detalhe (tipo6), campos de participante (C2-5). Ponto de consulta mínimo — tabelas vazias em produção hoje; pensada pra C2-10 reaproveitar quando destravar.';

GRANT EXECUTE ON FUNCTION public.fin_buscar_financeiro_participante_getnet(uuid, text, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_buscar_financeiro_participante_getnet(uuid, text, jsonb) FROM anon;

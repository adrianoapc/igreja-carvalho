-- ============================================================================
-- Ciclo 2 (C2-4) — RPCs de leitura: ajustes Getnet + linhas CI de getnet_resumo
--
-- `getnet_ajustes` (Tabela II do manual — 22 motivos, aluguel de POS,
-- chargeback, etc.) e as linhas `getnet_resumo.indicador_tipo_pagamento=
-- 'CI'` (Cobrança Interna — inclui `valor_liquido_cobranca`/
-- `id_baixa_cobranca_servico` desde a C2-3) são gravadas pelo import Getnet
-- desde sempre e nunca lidas por nenhuma tela/RPC — a dedução real que
-- motivou o Ciclo 2 (histórico do usuário de aluguel de POS descontado do
-- repasse sem visibilidade nenhuma) mora exatamente aqui.
--
-- 2 RPCs read-only, mesmo padrão de tenant/filial de `fin_stats_cartao_
-- getnet` (C2-2, `20260810110000`): resolve igreja via `fin_resolver_
-- contexto`, valida a integração pertence ao tenant e é `provedor=getnet`,
-- `has_filial_access` contra a filial EFETIVA da integração.
--
-- `getnet_ajustes` NÃO tem coluna `filial_id` (schema `20260617000001`) —
-- diferente de `getnet_resumo`, que tem. Pra ajustes, `p_filial_id` só
-- valida acesso do chamador (não filtra linha nenhuma, já que não existe
-- dimensão de filial por linha); pra CI (getnet_resumo), `p_filial_id` filtra
-- de verdade via `r.filial_id`, mesmo padrão `v_scope` de fin_stats_cartao_
-- getnet.
--
-- Implicação de segurança consciente, ESCOPO REAL maior que "só integração
-- compartilhada" (achado do code-review, não corrigido nesta fase —
-- pré-existente, não introduzido por este diff): as RLS policies de
-- `getnet_ajustes`/`getnet_resumo` (`getnet_ajustes_select`/`getnet_resumo_
-- select`, migrations `20260617000001`/`20260603221141`, MESES antes deste
-- ciclo) checam só `igreja_id = get_current_user_igreja_id() AND has_role
-- (admin|admin_igreja|tesoureiro|super_admin)` — ZERO dimensão de filial na
-- própria RLS. `has_filial_access` só existe dentro desta RPC; um
-- tesoureiro/admin_igreja acessando as tabelas DIRETO via PostgREST (fora
-- da RPC, ex. devtools/Postman com a própria sessão) enxerga toda linha da
-- igreja em QUALQUER filial, mesmo pra integração NÃO-compartilhada. A
-- validação `has_filial_access` desta RPC não é um reforço redundante —
-- é a ÚNICA barreira de filial que existe pra este dado, e só protege quem
-- passa pela RPC. Mesma classe de achado que motivou a auditoria dedicada
-- de `[[project-financeiro-rpcs-sem-filial-access]]` (§9.81) pras 7 RPCs
-- core — aqui é RLS de tabela Getnet, não RPC, mas o padrão "faltou
-- has_filial_access" é idêntico. Resolver de verdade exige apertar RLS/
-- GRANT em getnet_ajustes/getnet_resumo (ou revogar SELECT direto de
-- authenticated, como as 7 tabelas core do financeiro já têm pra INSERT/
-- UPDATE/DELETE) — fora do escopo de uma fase de RPC de leitura nova;
-- fica registrado aqui pra virar fase dedicada, não surpresa numa
-- auditoria futura.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fin_listar_ajustes_getnet(
  p_integracao_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date,
  p_filial_id uuid DEFAULT NULL,
  p_contexto jsonb DEFAULT NULL
)
RETURNS TABLE(
  ajuste_id uuid,
  arquivo_nome text,
  rv_ajustado text,
  data_rv date,
  data_pagamento_rv date,
  motivo_codigo text,
  motivo_descricao text,
  sinal char(1),
  valor_ajuste numeric,
  cartao_truncado text,
  rv_original text,
  nsu_cv text,
  numero_terminal text,
  data_transacao_original date
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
  IF p_filial_id IS NOT NULL AND NOT public.has_filial_access(v_igreja, p_filial_id) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial solicitada';
  END IF;

  -- COALESCE(data_pagamento_rv, data_rv): data financeira efetiva do
  -- ajuste no extrato Getnet (mesmo critério do import em
  -- getnet-sftp/index.ts — `dataPagamentoRv || dataRv` pra
  -- data_transacao do extrato bancário). Preferir data_rv fazia o ajuste
  -- desaparecer do mês em que realmente afeta a conciliação bancária
  -- quando o RV nasce num mês e o desconto/pagamento cai no seguinte
  -- (achado Codex P1 no PR #92). Ambas nullable no schema — se as duas
  -- forem NULL a linha some do filtro (aceito: sem data financeira não
  -- há período onde encaixar).
  RETURN QUERY
  SELECT
    a.id,
    a.arquivo_nome,
    a.rv_ajustado,
    a.data_rv,
    a.data_pagamento_rv,
    a.motivo_ajuste,
    -- `a.motivo_ajuste` é nullable (achado do code-review): `'...' || NULL
    -- || ')'` já colapsa pra NULL antes do COALESCE avaliar — sem o
    -- COALESCE interno, uma linha com motivo em branco (não só código não
    -- documentado) voltava motivo_descricao NULL, violando o contrato da
    -- RPC (coluna sempre string) e derrubando a UI pra célula vazia.
    COALESCE(m.descricao, 'Código desconhecido (' || COALESCE(a.motivo_ajuste, '?') || ')'),
    a.sinal,
    a.valor_ajuste,
    a.cartao_truncado,
    a.rv_original,
    a.nsu_cv,
    a.numero_terminal,
    a.data_transacao_original
  FROM public.getnet_ajustes a
  LEFT JOIN public.getnet_motivos_ajuste m ON m.codigo = a.motivo_ajuste
  WHERE a.igreja_id = v_igreja
    AND a.integracao_id = p_integracao_id
    AND COALESCE(a.data_pagamento_rv, a.data_rv) BETWEEN p_periodo_inicio AND p_periodo_fim
  ORDER BY COALESCE(a.data_pagamento_rv, a.data_rv) DESC, a.rv_ajustado;
END;
$$;

COMMENT ON FUNCTION public.fin_listar_ajustes_getnet(uuid, date, date, uuid, jsonb) IS
  'Leitura de getnet_ajustes (Tabela II do manual, C2-4) — decodifica motivo_ajuste via getnet_motivos_ajuste. p_filial_id só valida acesso (getnet_ajustes não tem coluna filial_id).';

GRANT EXECUTE ON FUNCTION public.fin_listar_ajustes_getnet(uuid, date, date, uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_listar_ajustes_getnet(uuid, date, date, uuid, jsonb) FROM anon;

CREATE OR REPLACE FUNCTION public.fin_listar_resumo_ci_getnet(
  p_integracao_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date,
  p_filial_id uuid DEFAULT NULL,
  p_contexto jsonb DEFAULT NULL
)
RETURNS TABLE(
  resumo_id uuid,
  arquivo_nome text,
  rv text,
  data_rv date,
  data_pagamento_rv date,
  valor_bruto numeric,
  valor_liquido numeric,
  valor_liquido_cobranca numeric,
  id_baixa_cobranca_servico text,
  sinal char(1),
  banco text,
  agencia text,
  conta_corrente text
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
  v_scope uuid;
BEGIN
  IF p_integracao_id IS NULL THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: p_integracao_id é obrigatório';
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

  IF p_filial_id IS NOT NULL THEN
    IF NOT public.has_filial_access(v_igreja, p_filial_id) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial solicitada';
    END IF;
    v_scope := p_filial_id;
  ELSE
    v_scope := NULL;
  END IF;

  -- Sem filtro de valor_liquido_cobranca IS NOT NULL — linha CI some do
  -- resultado só se sair do período/integração, nunca por dedução vazia
  -- (achado do C2-3: seq 29 nem sempre vem preenchida mesmo em CI).
  --
  -- Mesmo critério de data financeira das linhas de ajuste (e do import
  -- Getnet): data_pagamento_rv primeiro, fallback data_rv. Filtrar só por
  -- data_rv desalinha o card do período de conciliação quando pagamento
  -- e origem do RV caem em meses diferentes (Codex P1 no PR #92).
  RETURN QUERY
  SELECT
    r.id,
    r.arquivo_nome,
    r.rv,
    r.data_rv,
    r.data_pagamento_rv,
    r.valor_bruto,
    r.valor_liquido,
    r.valor_liquido_cobranca,
    r.id_baixa_cobranca_servico,
    r.sinal,
    r.banco,
    r.agencia,
    r.conta_corrente
  FROM public.getnet_resumo r
  WHERE r.igreja_id = v_igreja
    AND r.integracao_id = p_integracao_id
    AND r.indicador_tipo_pagamento = 'CI'
    AND COALESCE(r.data_pagamento_rv, r.data_rv) BETWEEN p_periodo_inicio AND p_periodo_fim
    AND public.has_filial_access(v_igreja, r.filial_id)
    AND (v_scope IS NULL OR r.filial_id IS NULL OR r.filial_id = v_scope)
  ORDER BY COALESCE(r.data_pagamento_rv, r.data_rv) DESC, r.rv;
END;
$$;

COMMENT ON FUNCTION public.fin_listar_resumo_ci_getnet(uuid, date, date, uuid, jsonb) IS
  'Leitura de getnet_resumo WHERE indicador_tipo_pagamento=CI (Cobrança Interna, C2-4) — inclui valor_liquido_cobranca/id_baixa_cobranca_servico (C2-3). Não filtra por valor_liquido_cobranca preenchido.';

GRANT EXECUTE ON FUNCTION public.fin_listar_resumo_ci_getnet(uuid, date, date, uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fin_listar_resumo_ci_getnet(uuid, date, date, uuid, jsonb) FROM anon;

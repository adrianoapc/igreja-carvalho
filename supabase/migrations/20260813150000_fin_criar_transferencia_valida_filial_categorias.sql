-- Achado numa auditoria independente (não veio de review do Codex — a
-- memória original desta auditoria, project-financeiro-rpcs-sem-filial-
-- access, listava isso como pendente há 9 dias; a maioria dos outros itens
-- da lista original já tinha sido corrigida em sessões não documentadas
-- aqui, verificado direto contra pg_get_functiondef/pg_policy antes deste
-- fix, guardrail de nunca confiar em memória sem checar a fonte real).
--
-- fin_criar_transferencia valida TENANT de categoria_saida_id/categoria_
-- entrada_id (fin_validar_fk_tenant), mas nunca validou FILIAL de nenhum
-- dos 5 campos de catálogo que resolve (as 2 categorias + subcategoria_
-- saida_id/base_ministerial_id/centro_custo_id) — e os últimos 3 nem tenant
-- tinham. TransferenciaDialog.tsx (frontend) resolve todos os 5 por nome
-- (`.ilike(...).limit(1).single()`) sem filtro de filial nenhum — se duas
-- filiais tiverem categoria/subcategoria/base/centro de custo com nomes
-- parecidos, a busca pode trazer o registro da filial ERRADA, e o backend
-- não tinha nenhum check que pegasse isso.
--
-- Fix: fin_validar_fk_tenant nos 3 campos que nunca tinham (subcategoria/
-- base/centro de custo) + fin_validar_fk_filial (já existe, mesmo padrão
-- usado em fin_criar_lancamento) nos 5, contra v_filial (a filial EFETIVA
-- da própria transferência, já resolvida e validada contra o chamador
-- acima) — não contra o chamador direto, e sim consistência do catálogo
-- com a filial da transação sendo criada (mesma semântica de
-- fin_validar_fk_filial nas outras RPCs).
--
-- Migration NOVA (forward), corpo inteiro da função via CREATE OR REPLACE —
-- guardrail 6b (docs/guardrails-financeiro.md): fin_criar_transferencia já
-- está deployada; editar o arquivo histórico não reescreve o corpo no
-- próximo `supabase db push`. Fonte confirmada como a versão mais recente
-- via `grep -rl "CREATE OR REPLACE FUNCTION public.fin_criar_transferencia"
-- supabase/migrations/*.sql | sort` (20260731390000).

CREATE OR REPLACE FUNCTION public.fin_criar_transferencia(
  p_conta_origem_id uuid,
  p_conta_destino_id uuid,
  p_valor numeric,
  p_data date,
  p_extras jsonb DEFAULT '{}'::jsonb,
  p_contexto jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ctx jsonb;
  v_igreja uuid;
  v_filial uuid;
  v_transf uuid;
  v_tx_saida uuid;
  v_tx_entrada uuid;
  v_nome_origem text;
  v_nome_destino text;
  v_forma_transf_id uuid;
  v_conta_origem_filial uuid;
  v_conta_destino_filial uuid;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: valor deve ser positivo';
  END IF;
  IF p_conta_origem_id = p_conta_destino_id THEN
    RAISE EXCEPTION 'FIN_VALIDACAO: contas de origem e destino devem ser diferentes';
  END IF;

  v_ctx := public.fin_resolver_contexto(p_contexto, 'autorizado_lancar_depositos');
  v_igreja := (v_ctx ->> 'igreja_id')::uuid;
  v_filial := NULLIF(v_ctx ->> 'filial_id', '')::uuid;
  IF p_extras ? 'filial_id' THEN
    v_filial := NULLIF(p_extras ->> 'filial_id', '')::uuid;
    -- Achado de auditoria de segurança dedicada (não veio de review do
    -- Codex): v_filial nunca era validada contra o chamador — só as 2
    -- CONTAS abaixo tinham has_filial_access (§9.74). Mesmo padrão já
    -- usado em fin_criar_lancamento pro mesmo campo (p_extras.filial_id).
    IF v_filial IS NOT NULL AND (v_ctx ->> 'canal') = 'web'
       AND NOT public.has_filial_access(v_igreja, v_filial) THEN
      RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial informada';
    END IF;
  END IF;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_origem_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('contas', p_conta_destino_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', NULLIF(p_extras ->> 'categoria_saida_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', NULLIF(p_extras ->> 'categoria_entrada_id','')::uuid, v_igreja);
  -- Subcategoria/base ministerial/centro de custo nunca tinham NENHUMA
  -- validação (nem tenant) — achado novo desta rodada, mesma classe do
  -- gap de categoria acima.
  PERFORM public.fin_validar_fk_tenant('subcategorias_financeiras', NULLIF(p_extras ->> 'subcategoria_saida_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('bases_ministeriais', NULLIF(p_extras ->> 'base_ministerial_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('centros_custo', NULLIF(p_extras ->> 'centro_custo_id','')::uuid, v_igreja);

  -- §9.74: nunca validava se o chamador tem acesso à filial das contas
  -- envolvidas — tesoureiro restrito à filial B conseguia mover dinheiro
  -- entre 2 contas de OUTRA filial (SECURITY DEFINER bypassa RLS).
  SELECT filial_id INTO v_conta_origem_filial FROM public.contas WHERE id = p_conta_origem_id;
  SELECT filial_id INTO v_conta_destino_filial FROM public.contas WHERE id = p_conta_destino_id;
  IF NOT public.has_filial_access(v_igreja, v_conta_origem_filial) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta de origem';
  END IF;
  IF NOT public.has_filial_access(v_igreja, v_conta_destino_filial) THEN
    RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial da conta de destino';
  END IF;

  -- Novo (2026-08-13): consistência de filial do CATÁLOGO com a filial
  -- EFETIVA da própria transferência (v_filial, já validada contra o
  -- chamador acima) — mesmo padrão de fin_validar_fk_filial já usado em
  -- fin_criar_lancamento. TransferenciaDialog.tsx resolve os 5 campos por
  -- nome sem filtro de filial (fix irmão no frontend, mesma rodada); sem
  -- este check, uma resolução errada no cliente gravaria a transferência
  -- referenciando categoria/subcategoria/base/centro de custo de outra
  -- filial sem nenhum bloqueio no banco.
  PERFORM public.fin_validar_fk_filial('categorias_financeiras', NULLIF(p_extras ->> 'categoria_saida_id','')::uuid, v_filial);
  PERFORM public.fin_validar_fk_filial('categorias_financeiras', NULLIF(p_extras ->> 'categoria_entrada_id','')::uuid, v_filial);
  PERFORM public.fin_validar_fk_filial('subcategorias_financeiras', NULLIF(p_extras ->> 'subcategoria_saida_id','')::uuid, v_filial);
  PERFORM public.fin_validar_fk_filial('bases_ministeriais', NULLIF(p_extras ->> 'base_ministerial_id','')::uuid, v_filial);
  PERFORM public.fin_validar_fk_filial('centros_custo', NULLIF(p_extras ->> 'centro_custo_id','')::uuid, v_filial);

  -- Trava as duas contas em ordem determinística (por id) ANTES de
  -- qualquer INSERT pago — evita deadlock entre 2 transferências
  -- concorrentes em direções opostas. FOR NO KEY UPDATE (§9.65): compatível
  -- com o KEY SHARE que qualquer INSERT em transacoes_financeiras já retém
  -- nessas contas via FK.
  PERFORM 1 FROM public.contas
   WHERE id IN (p_conta_origem_id, p_conta_destino_id)
   ORDER BY id
     FOR NO KEY UPDATE;

  SELECT nome INTO v_nome_origem FROM public.contas WHERE id = p_conta_origem_id;
  SELECT nome INTO v_nome_destino FROM public.contas WHERE id = p_conta_destino_id;

  SELECT id INTO v_forma_transf_id FROM public.formas_pagamento
   WHERE igreja_id = v_igreja AND nome = 'Transferência Bancária' AND ativo = true
     AND (filial_id IS NOT DISTINCT FROM v_filial OR filial_id IS NULL)
   ORDER BY (filial_id IS NOT DISTINCT FROM v_filial) DESC, created_at ASC
   LIMIT 1;

  INSERT INTO public.transferencias_contas (
    conta_origem_id, conta_destino_id, valor,
    data_transferencia, data_competencia, observacoes, anexo_url,
    igreja_id, filial_id, status, criado_por, sessao_id
  ) VALUES (
    p_conta_origem_id, p_conta_destino_id, p_valor,
    p_data, p_data,
    NULLIF(p_extras ->> 'observacoes',''),
    NULLIF(p_extras ->> 'anexo_url',''),
    v_igreja, v_filial, 'executada',
    COALESCE(NULLIF(p_extras ->> 'criado_por','')::uuid, (v_ctx ->> 'ator_profile_id')::uuid),
    NULLIF(p_extras ->> 'sessao_bot_id','')::uuid
  ) RETURNING id INTO v_transf;

  INSERT INTO public.transacoes_financeiras (
    tipo, tipo_lancamento, descricao, valor,
    data_vencimento, data_pagamento, data_competencia, status,
    forma_pagamento, forma_pagamento_id, conta_id, categoria_id, subcategoria_id,
    base_ministerial_id, centro_custo_id, transferencia_id,
    observacoes, anexo_url, lancado_por, igreja_id, filial_id
  ) VALUES (
    'saida', 'unico',
    COALESCE(NULLIF(p_extras ->> 'descricao_saida',''),
             'Transferência para ' || COALESCE(v_nome_destino, 'outra conta')),
    p_valor, p_data, p_data, p_data, 'pago',
    COALESCE(NULLIF(p_extras ->> 'forma_pagamento',''), 'Transferência Bancária'),
    v_forma_transf_id,
    p_conta_origem_id,
    NULLIF(p_extras ->> 'categoria_saida_id','')::uuid,
    NULLIF(p_extras ->> 'subcategoria_saida_id','')::uuid,
    NULLIF(p_extras ->> 'base_ministerial_id','')::uuid,
    NULLIF(p_extras ->> 'centro_custo_id','')::uuid,
    v_transf,
    NULLIF(p_extras ->> 'observacoes',''),
    NULLIF(p_extras ->> 'anexo_url',''),
    (v_ctx ->> 'ator_user_id')::uuid,
    v_igreja, v_filial
  ) RETURNING id INTO v_tx_saida;

  INSERT INTO public.transacoes_financeiras (
    tipo, tipo_lancamento, descricao, valor,
    data_vencimento, data_pagamento, data_competencia, status,
    forma_pagamento, forma_pagamento_id, conta_id, categoria_id,
    base_ministerial_id, centro_custo_id, transferencia_id,
    observacoes, anexo_url, lancado_por, igreja_id, filial_id
  ) VALUES (
    'entrada', 'unico',
    COALESCE(NULLIF(p_extras ->> 'descricao_entrada',''),
             'Transferência de ' || COALESCE(v_nome_origem, 'outra conta')),
    p_valor, p_data, p_data, p_data, 'pago',
    COALESCE(NULLIF(p_extras ->> 'forma_pagamento',''), 'Transferência Bancária'),
    v_forma_transf_id,
    p_conta_destino_id,
    NULLIF(p_extras ->> 'categoria_entrada_id','')::uuid,
    NULLIF(p_extras ->> 'base_ministerial_id','')::uuid,
    NULLIF(p_extras ->> 'centro_custo_id','')::uuid,
    v_transf,
    NULLIF(p_extras ->> 'observacoes',''),
    NULLIF(p_extras ->> 'anexo_url',''),
    (v_ctx ->> 'ator_user_id')::uuid,
    v_igreja, v_filial
  ) RETURNING id INTO v_tx_entrada;

  UPDATE public.transferencias_contas
     SET transacao_saida_id = v_tx_saida,
         transacao_entrada_id = v_tx_entrada,
         updated_at = now()
   WHERE id = v_transf;

  -- Os 2 INSERTs acima (status='pago' direto) já movem saldo_atual das duas
  -- contas via trigger_atualizar_saldo_conta. Compensação manual removida
  -- (duplicaria o movimento).

  PERFORM public.fin_registrar_auditoria(
    v_ctx, 'fin_criar_transferencia', 'transferencias_contas', v_transf,
    jsonb_build_object('conta_origem_id', p_conta_origem_id,
                       'conta_destino_id', p_conta_destino_id,
                       'valor', p_valor, 'data', p_data, 'extras', p_extras),
    jsonb_build_object('transacao_saida_id', v_tx_saida,
                       'transacao_entrada_id', v_tx_entrada));

  RETURN jsonb_build_object('ok', true, 'id', v_transf,
                            'transacao_saida_id', v_tx_saida,
                            'transacao_entrada_id', v_tx_entrada,
                            'warnings', '[]'::jsonb);
END;
$$;

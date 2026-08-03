-- ============================================================================
-- 2 achados do /code-review (PR #67, rodada de 02/08 01:10, commit revisado
-- 5ef1a70), reais:
--
-- 1) P2 — fin_criar_transferencia (20260731100000/270000) resolve a forma
--    "Transferência Bancária" por nome só com `igreja_id = v_igreja`, sem
--    filtro de filial — mesma classe de §9.61/§9.62/§9.64 (forma_
--    pagamento_id sem check de filial), que eu tinha fechado em
--    fin_criar_lancamento/fin_atualizar_lancamento mas não aqui, porque
--    esta função não passa pelo resolvedor de rótulo daquelas (faz o
--    INSERT direto, não chama fin_criar_lancamento). Numa igreja com
--    "Transferência Bancária" cadastrada por filial, uma transferência da
--    filial B podia gravar a forma mais antiga da filial A —
--    forma_pagamento_id filial-scoped, RLS esconde ela de quem está na
--    filial B (a própria filial da transação).
--
--    Fix: mesmo padrão de resolução por rótulo já usado em
--    fin_criar_lancamento (§9.61) — restringe a candidatos da MESMA
--    filial efetiva (`v_filial`) ou globais, prioriza a própria filial
--    sobre o global, nunca resolve pra uma filial diferente.
--
-- 2) P2 — LancarDesagioDialog.tsx: trocar a CONTA (extrato global, "Todas
--    as filiais") recarrega as opções de categoria pra filial da nova
--    conta, mas não limpa `categoriaId` já selecionado — o botão continua
--    habilitado e submete a categoria antiga (agora fora da lista, "hidden"
--    no Select), que `fin_validar_fk_filial` rejeita no backend. Eu já
--    tinha identificado esse risco (comentário no código anterior) mas não
--    corrigido proativamente, tratando como só um UX rough edge — o
--    review confirmou que é achado de verdade.
--
--    Fix: `useEffect` reseta `categoriaId` sempre que `contaId` muda
--    (mesmo padrão de "estado escopado por contexto precisa resetar
--    quando o contexto muda", guardrail A.4).
-- ============================================================================

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
  END IF;

  PERFORM public.fin_validar_fk_tenant('contas', p_conta_origem_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('contas', p_conta_destino_id, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', NULLIF(p_extras ->> 'categoria_saida_id','')::uuid, v_igreja);
  PERFORM public.fin_validar_fk_tenant('categorias_financeiras', NULLIF(p_extras ->> 'categoria_entrada_id','')::uuid, v_igreja);

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

  -- §9.66: mesma regra de filial já aplicada à resolução por rótulo em
  -- fin_criar_lancamento (§9.61) — restringe a candidatos da MESMA filial
  -- efetiva (v_filial) ou globais, prioriza a própria filial sobre o
  -- global, nunca resolve pra uma filial diferente (achado do /code-review:
  -- igreja com "Transferência Bancária" cadastrada por filial podia gravar
  -- a forma da filial errada, invisível via RLS pra quem está na filial
  -- certa da transação).
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

-- =============================================
-- SINCRONIZAÇÃO DE CONCILIAÇÕES EM TRANSFERÊNCIAS
-- =============================================
--
-- Este script marca as transações de SAÍDA como conciliadas quando a 
-- transação de ENTRADA correspondente (de uma transferência bancária) 
-- foi conciliada com o extrato.
--
-- USO:
-- Execute este script periodicamente (ex: diariamente) via Supabase RPC 
-- ou como uma função agendada (cron job).
--
-- LÓGICA:
-- 1. Encontra transações de ENTRADA conciliadas com extrato (conciliacao_status = 'conciliado_extrato')
-- 2. Identifica a transferência associada
-- 3. Encontra a transação de SAÍDA correspondente
-- 4. Marca a transação de SAÍDA com o mesmo status de conciliação
-- 5. Registra auditoria das mudanças
--
-- =============================================

-- Criar função para sincronizar conciliações de transferências
CREATE OR REPLACE FUNCTION public.sincronizar_conciliacao_transferencias(
  p_igreja_id UUID,
  p_filial_id UUID DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS TABLE (
  transacao_entrada_id UUID,
  transacao_saida_id UUID,
  conciliacao_status TEXT,
  descricao TEXT,
  sucesso BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrada RECORD;
  v_saida RECORD;
  v_transferencia RECORD;
  v_count_sincronizadas INTEGER := 0;
BEGIN
  -- Validar acesso (simples check de igreja)
  IF NOT EXISTS(
    SELECT 1 FROM public.igrejas WHERE id = p_igreja_id
  ) THEN
    RAISE EXCEPTION 'Igreja não encontrada';
  END IF;

  -- Cursor para encontrar ENTRADAS conciliadas
  FOR v_entrada IN
    SELECT 
      t.id,
      t.transferencia_id,
      t.conciliacao_status,
      t.descricao,
      t.data_vencimento
    FROM public.transacoes_financeiras t
    WHERE t.tipo = 'entrada'
      AND t.transferencia_id IS NOT NULL
      AND t.conciliacao_status IN ('conciliado_extrato', 'conciliado_manual', 'conciliado_bot', 'conferido_manual')
      AND t.igreja_id = p_igreja_id
      AND (p_filial_id IS NULL OR t.filial_id = p_filial_id)
    ORDER BY t.data_vencimento DESC
  LOOP
    -- Buscar a transferência
    SELECT * INTO v_transferencia
    FROM public.transferencias_contas
    WHERE id = v_entrada.transferencia_id
      AND igreja_id = p_igreja_id
      AND (p_filial_id IS NULL OR filial_id = p_filial_id);

    IF v_transferencia.id IS NULL THEN
      CONTINUE; -- Pular se não encontrou a transferência
    END IF;

    -- Buscar a SAÍDA correspondente
    SELECT * INTO v_saida
    FROM public.transacoes_financeiras
    WHERE transferencia_id = v_entrada.transferencia_id
      AND tipo = 'saida'
      AND igreja_id = p_igreja_id;

    IF v_saida.id IS NULL THEN
      CONTINUE; -- Pular se não encontrou a saída
    END IF;

    -- Verificar se já está com o mesmo status (evitar re-sincronização desnecessária)
    IF v_saida.conciliacao_status = v_entrada.conciliacao_status THEN
      CONTINUE;
    END IF;

    -- Atualizar a transação de SAÍDA com o status de conciliação da ENTRADA
    UPDATE public.transacoes_financeiras
    SET 
      conciliacao_status = v_entrada.conciliacao_status,
      updated_at = NOW()
    WHERE id = v_saida.id;

    -- Se a entrada foi conciliada com extrato e a saída está pendente, marcar como paga
    IF v_entrada.conciliacao_status = 'conciliado_extrato' 
       AND v_saida.status = 'pendente' THEN
      UPDATE public.transacoes_financeiras
      SET 
        status = 'pago',
        data_pagamento = COALESCE(v_entrada.data_vencimento, NOW()::DATE),
        updated_at = NOW()
      WHERE id = v_saida.id;
    END IF;

    -- Registrar auditoria
    INSERT INTO public.auditoria_conciliacoes (
      transacao_id,
      tipo_reconciliacao,
      observacoes,
      usuario_id,
      igreja_id,
      filial_id
    )
    VALUES (
      v_saida.id,
      'sincronizacao_transferencia',
      FORMAT('Sincronizado status de conciliação: %s (entrada: %s)', v_entrada.conciliacao_status, v_entrada.id),
      p_usuario_id,
      p_igreja_id,
      p_filial_id
    );

    v_count_sincronizadas := v_count_sincronizadas + 1;

    -- Retornar resultado
    RETURN QUERY SELECT
      v_entrada.id,
      v_saida.id,
      v_entrada.conciliacao_status,
      FORMAT('Sincronizada SAÍDA %s com ENTRADA %s', v_saida.id, v_entrada.id),
      TRUE;
  END LOOP;

  -- Log final
  RAISE NOTICE 'Sincronização de transferências concluída: % transações atualizadas', v_count_sincronizadas;
END;
$$;

-- =============================================
-- FUNÇÃO ALTERNATIVA (RPC para Supabase)
-- =============================================
--
-- Esta função é mais simples e otimizada para ser chamada via RPC
-- do frontend/Supabase Dashboard
--

CREATE OR REPLACE FUNCTION public.sincronizar_transferencias_reconciliacao(
  p_limite INTEGER DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado jsonb;
  v_atualizacoes INTEGER;
  v_erros INTEGER := 0;
BEGIN
  -- Buscar contexto do usuário
  DECLARE
    v_chiesa_id UUID := public.get_jwt_igreja_id();
    v_filial_id UUID := public.get_jwt_filial_id();
    v_usuario_id UUID := auth.uid();
  BEGIN
    -- Validação
    IF v_chiesa_id IS NULL THEN
      RAISE EXCEPTION 'Sem acesso à identificação da igreja';
    END IF;

    -- Executa sincronização
    WITH entradas_conciliadas AS (
      -- 1. Seleciona ENTRADAS conciliadas com transferência
      SELECT 
        t.id as entrada_id,
        t.transferencia_id,
        t.conciliacao_status,
        t.data_vencimento
      FROM public.transacoes_financeiras t
      WHERE t.tipo = 'entrada'
        AND t.transferencia_id IS NOT NULL
        AND t.conciliacao_status IN ('conciliado_extrato', 'conciliado_manual', 'conciliado_bot', 'conferido_manual')
        AND t.igreja_id = v_chiesa_id
        AND (v_filial_id IS NULL OR t.filial_id = v_filial_id)
      LIMIT p_limite
    ),
    saidas_para_sincronizar AS (
      -- 2. Encontra SAÍDAS correspondentes
      SELECT 
        ec.entrada_id,
        ts.id as saida_id,
        ec.conciliacao_status,
        ts.conciliacao_status as status_atual,
        ec.data_vencimento
      FROM entradas_conciliadas ec
      INNER JOIN public.transacoes_financeiras ts
        ON ts.transferencia_id = ec.transferencia_id
        AND ts.tipo = 'saida'
      WHERE ts.conciliacao_status IS DISTINCT FROM ec.conciliacao_status -- Apenas diferentes
    )
    -- 3. Atualiza as SAÍDAS
    UPDATE public.transacoes_financeiras ts
    SET 
      conciliacao_status = sps.conciliacao_status,
      status = CASE 
        WHEN sps.conciliacao_status = 'conciliado_extrato' AND ts.status = 'pendente'
        THEN 'pago'
        ELSE ts.status
      END,
      data_pagamento = CASE 
        WHEN sps.conciliacao_status = 'conciliado_extrato' AND ts.status = 'pendente'
        THEN sps.data_vencimento
        ELSE ts.data_pagamento
      END,
      updated_at = NOW()
    FROM saidas_para_sincronizar sps
    WHERE ts.id = sps.saida_id;

    GET DIAGNOSTICS v_atualizacoes = ROW_COUNT;

    -- Retornar resultado
    v_resultado := jsonb_build_object(
      'sucesso', TRUE,
      'atualizacoes', v_atualizacoes,
      'mensagem', FORMAT('Sincronizadas %s transações de saída com suas correspondentes entradas', v_atualizacoes)
    );

    RETURN v_resultado;

  END;
EXCEPTION WHEN OTHERS THEN
  v_resultado := jsonb_build_object(
    'sucesso', FALSE,
    'erro', SQLERRM,
    'detalhes', 'Verifique logs para mais informações'
  );
  RETURN v_resultado;
END;
$$;

-- =============================================
-- AUDIT/LOG TABLE (se não existir)
-- =============================================
CREATE TABLE IF NOT EXISTS public.auditoria_conciliacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transacao_id UUID REFERENCES public.transacoes_financeiras(id) ON DELETE CASCADE,
  tipo_reconciliacao TEXT NOT NULL,
  observacoes TEXT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  igreja_id UUID NOT NULL,
  filial_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_conciliacoes_transacao 
ON public.auditoria_conciliacoes(transacao_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_conciliacoes_tipo 
ON public.auditoria_conciliacoes(tipo_reconciliacao);

-- =============================================
-- INSTRUÇÕES DE USO
-- =============================================
--
-- VIA SQL (executa logo):
--   SELECT * FROM public.sincronizar_transferencias_reconciliacao(100);
--
-- VIA FRONTEND (RPC):
--   const { data, error } = await supabase.rpc('sincronizar_transferencias_reconciliacao', {
--     p_limite: 100
--   });
--
-- VIA CRON JOB (Supabase Functions):
--   Criar uma Edge Function que chama a RPC acima, 
--   e agendar via pg_cron:
--
--   SELECT cron.schedule('sync-transferencias-reconciliacao', '0 2 * * *', 
--     'SELECT public.sincronizar_transferencias_reconciliacao(1000)');
--
-- =============================================

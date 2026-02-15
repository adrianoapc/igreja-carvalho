
CREATE OR REPLACE FUNCTION diagnosticar_extrato(p_extrato_id UUID)
RETURNS TABLE (
  categoria TEXT,
  campo TEXT,
  valor TEXT,
  observacao TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
-- 1. Dados básicos do extrato
RETURN QUERY
SELECT 'EXTRATO BANCÁRIO'::TEXT, 'id'::TEXT, e.id::TEXT, 'Extrato encontrado'::TEXT
FROM extratos_bancarios e WHERE e.id = p_extrato_id;

RETURN QUERY
SELECT 'EXTRATO BANCÁRIO'::TEXT, 'reconciliado'::TEXT, e.reconciliado::TEXT,
CASE WHEN e.reconciliado THEN '❌ Marcado como conciliado - NÃO aparece na lista' ELSE '✓ Não conciliado - deveria aparecer' END
FROM extratos_bancarios e WHERE e.id = p_extrato_id;

RETURN QUERY
SELECT 'EXTRATO BANCÁRIO'::TEXT, 'transacao_vinculada_id'::TEXT, COALESCE(e.transacao_vinculada_id::TEXT, 'NULL'),
CASE WHEN e.transacao_vinculada_id IS NOT NULL THEN '❌ Tem vínculo 1:1 - NÃO aparece na lista' ELSE '✓ Sem vínculo 1:1' END
FROM extratos_bancarios e WHERE e.id = p_extrato_id;

RETURN QUERY
SELECT 'EXTRATO BANCÁRIO'::TEXT, 'descricao'::TEXT, e.descricao,
CASE WHEN e.descricao ILIKE '%contamax%' THEN '❌ Contém "contamax" - filtrado da lista' ELSE '✓ Descrição OK' END
FROM extratos_bancarios e WHERE e.id = p_extrato_id;

RETURN QUERY
SELECT 'EXTRATO BANCÁRIO'::TEXT, 'valor'::TEXT, e.valor::TEXT, 'Valor do extrato'::TEXT
FROM extratos_bancarios e WHERE e.id = p_extrato_id;

RETURN QUERY
SELECT 'EXTRATO BANCÁRIO'::TEXT, 'data_transacao'::TEXT, e.data_transacao::TEXT, 'Data da transação'::TEXT
FROM extratos_bancarios e WHERE e.id = p_extrato_id;

-- 2. Conciliações em lote
RETURN QUERY
SELECT 'CONCILIAÇÃO LOTE'::TEXT, 'qtd_lotes_vinculados'::TEXT, COUNT(*)::TEXT,
CASE WHEN COUNT(*) > 0 THEN '❌ Extrato vinculado em ' || COUNT(*) || ' lote(s) - NÃO aparece na lista' ELSE '✓ Sem vínculos em lotes' END
FROM conciliacoes_lote_extratos cle WHERE cle.extrato_id = p_extrato_id;

RETURN QUERY
SELECT 'CONCILIAÇÃO LOTE'::TEXT, 'lote_id_' || ROW_NUMBER() OVER (ORDER BY cle.created_at)::TEXT,
cle.conciliacao_lote_id::TEXT, 'Criado em ' || cle.created_at::TEXT
FROM conciliacoes_lote_extratos cle WHERE cle.extrato_id = p_extrato_id;

-- 3. Transações vinculadas via lote
RETURN QUERY
SELECT 'TRANSAÇÕES LOTE'::TEXT, 'transacao_' || ROW_NUMBER() OVER (ORDER BY t.created_at)::TEXT,
t.id::TEXT || ' | ' || t.descricao || ' | R$ ' || t.valor::TEXT,
'Status: ' || COALESCE(t.status, 'NULL') || ' | Conciliação: ' || COALESCE(t.conciliacao_status, 'NULL')
FROM conciliacoes_lote_extratos cle
JOIN conciliacoes_lote cl ON cl.id = cle.conciliacao_lote_id
JOIN transacoes_financeiras t ON t.id = cl.transacao_id
WHERE cle.extrato_id = p_extrato_id;

-- 4. Transação vinculada 1:1
RETURN QUERY
SELECT 'TRANSAÇÃO 1:1'::TEXT, 'transacao_vinculada'::TEXT,
t.id::TEXT || ' | ' || t.descricao || ' | R$ ' || t.valor::TEXT,
'Status: ' || COALESCE(t.status, 'NULL') || ' | Conciliação: ' || COALESCE(t.conciliacao_status, 'NULL')
FROM extratos_bancarios e
JOIN transacoes_financeiras t ON t.id = e.transacao_vinculada_id
WHERE e.id = p_extrato_id AND e.transacao_vinculada_id IS NOT NULL;

-- 5. Auditoria de conciliações (via transacao_id)
RETURN QUERY
SELECT 'AUDITORIA'::TEXT, 'conciliacao_' || ROW_NUMBER() OVER (ORDER BY ac.created_at DESC)::TEXT,
ac.tipo_reconciliacao || ' em ' || ac.created_at::TEXT,
'Transação: ' || COALESCE(ac.transacao_id::TEXT, 'NULL') || ' | Usuário: ' || COALESCE(ac.usuario_id::TEXT, 'NULL')
FROM auditoria_conciliacoes ac
WHERE ac.transacao_id IN (
  SELECT e.transacao_vinculada_id FROM extratos_bancarios e WHERE e.id = p_extrato_id AND e.transacao_vinculada_id IS NOT NULL
  UNION
  SELECT cl.transacao_id FROM conciliacoes_lote_extratos cle JOIN conciliacoes_lote cl ON cl.id = cle.conciliacao_lote_id WHERE cle.extrato_id = p_extrato_id
)
ORDER BY ac.created_at DESC
LIMIT 5;

-- 6. Audit logs (reconciliacao_audit_logs) - usando colunas reais
RETURN QUERY
SELECT 'AUDIT LOGS'::TEXT, 'log_' || ROW_NUMBER() OVER (ORDER BY ral.created_at DESC)::TEXT,
ral.tipo_reconciliacao || ' em ' || ral.created_at::TEXT,
'Extrato: ' || COALESCE(ral.extrato_id::TEXT, 'NULL') || ' | Transação: ' || COALESCE(ral.transacao_id::TEXT, 'NULL') ||
' | Score: ' || COALESCE(ral.score::TEXT, 'NULL') || ' | Obs: ' || COALESCE(ral.observacoes, 'NULL')
FROM reconciliacao_audit_logs ral
WHERE ral.extrato_id = p_extrato_id
ORDER BY ral.created_at DESC
LIMIT 5;

-- 7. Resumo diagnóstico
RETURN QUERY
SELECT 'DIAGNÓSTICO'::TEXT, 'motivo_nao_aparece'::TEXT,
CASE 
WHEN e.reconciliado THEN 'reconciliado=true'
WHEN e.transacao_vinculada_id IS NOT NULL THEN 'tem transacao_vinculada_id'
WHEN EXISTS (SELECT 1 FROM conciliacoes_lote_extratos WHERE extrato_id = p_extrato_id) THEN 'vinculado em conciliacoes_lote_extratos'
WHEN e.descricao ILIKE '%contamax%' THEN 'descrição contém "contamax"'
ELSE 'DEVERIA APARECER - verifique filtros de data/conta/filial'
END,
CASE 
WHEN e.reconciliado OR e.transacao_vinculada_id IS NOT NULL OR EXISTS (SELECT 1 FROM conciliacoes_lote_extratos WHERE extrato_id = p_extrato_id)
THEN '✓ Comportamento correto - extrato foi conciliado'
ELSE '⚠️ Possível problema - verifique filtros'
END
FROM extratos_bancarios e WHERE e.id = p_extrato_id;

END;
$$;

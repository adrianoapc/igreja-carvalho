
-- ============================================================
-- OTIMIZAÇÃO DE PERFORMANCE: ÍNDICES FALTANTES
-- ============================================================

-- 9. FILIAIS (índice simples em igreja_id)
CREATE INDEX IF NOT EXISTS idx_filiais_igreja
ON filiais(igreja_id);

-- ============================================================
-- ANALIZAR E COLETAR ESTATÍSTICAS
-- ============================================================
ANALYZE pedidos_oracao;
ANALYZE testemunhos;
ANALYZE eventos;
ANALYZE membros_time;
ANALYZE escalas;
ANALYZE transacoes_financeiras;
ANALYZE atendimentos_pastorais;
ANALYZE sentimentos_membros;
ANALYZE filiais;
ANALYZE profiles;

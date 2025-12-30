-- ================================================================
-- MIGRATION: Adicionar Blocos Inteligentes à tabela liturgias
-- Objetivo: Suportar blocos automáticos da Edge Function
-- ================================================================

-- 1. REMOVER CONSTRAINT ANTIGA SE EXISTIR
-- ----------------------------------------
ALTER TABLE public.liturgias 
DROP CONSTRAINT IF EXISTS liturgias_tipo_conteudo_check;

-- 2. ADICIONAR NOVA CONSTRAINT COM BLOCOS INTELIGENTES
-- -----------------------------------------------------
ALTER TABLE public.liturgias 
ADD CONSTRAINT liturgias_tipo_conteudo_check 
CHECK (tipo_conteudo IN (
  'ATO_PRESENCIAL', 
  'VIDEO', 
  'IMAGEM', 
  'VERSICULO', 
  'PEDIDOS', 
  'QUIZ', 
  'TIMER',
  'AUDIO',
  'TEXTO',
  'AVISO',
  'BLOCO_TESTEMUNHO',
  'BLOCO_SENTIMENTO',
  'BLOCO_VISITANTE',
  'BLOCO_PEDIDOS'
));

-- 3. ATUALIZAR COMENTÁRIO DA COLUNA
-- ----------------------------------
COMMENT ON COLUMN public.liturgias.tipo_conteudo IS 
'Tipo de conteúdo: ATO_PRESENCIAL, VIDEO, IMAGEM, VERSICULO, PEDIDOS, QUIZ, TIMER, AUDIO, TEXTO, AVISO, BLOCO_TESTEMUNHO, BLOCO_SENTIMENTO, BLOCO_VISITANTE, BLOCO_PEDIDOS';

-- 4. ADICIONAR ÍNDICE COMPOSTO PARA QUERIES DA EDGE FUNCTION
-- -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_liturgias_evento_tipo 
ON public.liturgias(evento_id, tipo_conteudo);

-- ================================================================
-- SCRIPT PARA APLICAR VIA SUPABASE DASHBOARD SQL EDITOR
-- Execute este script completo no SQL Editor do Supabase
-- ================================================================

-- PASSO 1: Ver constraint atual (apenas para debug)
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'liturgias' 
  AND conname = 'liturgias_tipo_conteudo_check';

-- PASSO 2: Remover constraint antiga
ALTER TABLE public.liturgias 
DROP CONSTRAINT IF EXISTS liturgias_tipo_conteudo_check;

-- PASSO 3: Adicionar nova constraint com TODOS os tipos
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

-- PASSO 4: Atualizar comentário da coluna
COMMENT ON COLUMN public.liturgias.tipo_conteudo IS 
'Tipo de conteúdo: ATO_PRESENCIAL, VIDEO, IMAGEM, VERSICULO, PEDIDOS, QUIZ, TIMER, AUDIO, TEXTO, AVISO, BLOCO_TESTEMUNHO, BLOCO_SENTIMENTO, BLOCO_VISITANTE, BLOCO_PEDIDOS (Blocos automáticos preenchidos pela Edge Function)';

-- PASSO 5: Criar índice composto para queries da Edge Function
CREATE INDEX IF NOT EXISTS idx_liturgias_evento_tipo 
ON public.liturgias(evento_id, tipo_conteudo);

-- PASSO 6: Verificar constraint atualizada
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'liturgias' 
  AND conname = 'liturgias_tipo_conteudo_check';

-- ================================================================
-- RESULTADO ESPERADO:
-- Você deve ver a constraint com todos os 14 tipos listados acima
-- ================================================================

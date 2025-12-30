-- Drop the existing check constraint and recreate with all needed types
ALTER TABLE public.liturgias DROP CONSTRAINT IF EXISTS liturgias_tipo_conteudo_check;

ALTER TABLE public.liturgias ADD CONSTRAINT liturgias_tipo_conteudo_check 
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
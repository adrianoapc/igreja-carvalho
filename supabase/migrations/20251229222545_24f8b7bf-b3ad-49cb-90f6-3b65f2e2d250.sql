-- ================================================================
-- MIGRATION: Evolução da tabela liturgias para Prayer Player
-- Objetivo: Suportar conteúdo digital (vídeos, versículos, pedidos)
-- ================================================================

-- 1. ADICIONAR COLUNAS DE CONTEÚDO DIGITAL
-- -----------------------------------------

-- tipo_conteudo: Define o tipo de conteúdo do item
-- Valores: ATO_PRESENCIAL (default), VIDEO, IMAGEM, VERSICULO, PEDIDOS, QUIZ, TIMER
ALTER TABLE public.liturgias 
ADD COLUMN IF NOT EXISTS tipo_conteudo TEXT NOT NULL DEFAULT 'ATO_PRESENCIAL';

-- conteudo_config: Configurações flexíveis em JSONB
-- Exemplos de uso:
--   VIDEO: {"url": "https://...", "autoplay": true, "loop": false}
--   VERSICULO: {"referencia": "João 3:16", "versao": "NVI"}
--   PEDIDOS: {"tags": ["urgente", "saude"], "limite": 5}
--   TIMER: {"duracao_segundos": 300, "som_final": true}
ALTER TABLE public.liturgias 
ADD COLUMN IF NOT EXISTS conteudo_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- bloqueio_progresso: Impede avanço manual (ex: vídeo obrigatório)
ALTER TABLE public.liturgias 
ADD COLUMN IF NOT EXISTS bloqueio_progresso BOOLEAN NOT NULL DEFAULT false;

-- 2. ADICIONAR COMENTÁRIOS PARA DOCUMENTAÇÃO
-- -------------------------------------------
COMMENT ON COLUMN public.liturgias.tipo_conteudo IS 
'Tipo de conteúdo do item: ATO_PRESENCIAL, VIDEO, IMAGEM, VERSICULO, PEDIDOS, QUIZ, TIMER';

COMMENT ON COLUMN public.liturgias.conteudo_config IS 
'Configurações flexíveis do conteúdo em JSONB (URL, tags, referências, etc)';

COMMENT ON COLUMN public.liturgias.bloqueio_progresso IS 
'Se true, impede que o usuário avance manualmente (ex: vídeo obrigatório)';

-- 3. CRIAR ÍNDICE PARA CONSULTAS POR TIPO DE CONTEÚDO
-- ----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_liturgias_tipo_conteudo 
ON public.liturgias(tipo_conteudo);

-- 4. CRIAR CHECK CONSTRAINT PARA VALIDAR TIPOS CONHECIDOS
-- --------------------------------------------------------
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'liturgias_tipo_conteudo_check'
  ) THEN
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
      'TEXTO'
    ));
  END IF;
END $$;
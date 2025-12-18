-- Adicionar colunas de análise IA na tabela pedidos_oracao
ALTER TABLE public.pedidos_oracao 
ADD COLUMN IF NOT EXISTS analise_ia_titulo TEXT,
ADD COLUMN IF NOT EXISTS analise_ia_motivo TEXT,
ADD COLUMN IF NOT EXISTS analise_ia_gravidade TEXT,
ADD COLUMN IF NOT EXISTS analise_ia_resposta TEXT;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.pedidos_oracao.analise_ia_titulo IS 'Título gerado pela IA para o pedido';
COMMENT ON COLUMN public.pedidos_oracao.analise_ia_motivo IS 'Categoria/motivo identificado pela IA';
COMMENT ON COLUMN public.pedidos_oracao.analise_ia_gravidade IS 'Gravidade classificada pela IA (baixa, media, critica)';
COMMENT ON COLUMN public.pedidos_oracao.analise_ia_resposta IS 'Mensagem pastoral gerada pela IA';
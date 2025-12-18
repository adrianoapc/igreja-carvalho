-- Add AI analysis columns to sentimentos_membros
ALTER TABLE public.sentimentos_membros
ADD COLUMN IF NOT EXISTS analise_ia_titulo TEXT,
ADD COLUMN IF NOT EXISTS analise_ia_motivo TEXT,
ADD COLUMN IF NOT EXISTS analise_ia_gravidade TEXT,
ADD COLUMN IF NOT EXISTS analise_ia_resposta TEXT;

-- Add index for quick filtering by severity
CREATE INDEX IF NOT EXISTS idx_sentimentos_gravidade ON public.sentimentos_membros (analise_ia_gravidade);

-- Add comment for documentation
COMMENT ON COLUMN public.sentimentos_membros.analise_ia_titulo IS 'AI-generated short summary (3-5 words)';
COMMENT ON COLUMN public.sentimentos_membros.analise_ia_motivo IS 'AI-categorized root cause (Saúde, Família, Espiritual, etc)';
COMMENT ON COLUMN public.sentimentos_membros.analise_ia_gravidade IS 'AI severity: baixa, media, critica';
COMMENT ON COLUMN public.sentimentos_membros.analise_ia_resposta IS 'AI-generated pastoral comfort message';
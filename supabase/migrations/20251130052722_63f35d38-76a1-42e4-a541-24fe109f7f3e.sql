-- Adicionar coluna responsavel_id na tabela liturgia_culto
ALTER TABLE public.liturgia_culto
ADD COLUMN responsavel_id uuid REFERENCES public.profiles(id);

-- Criar índice para melhor performance nas consultas
CREATE INDEX idx_liturgia_culto_responsavel ON public.liturgia_culto(responsavel_id);
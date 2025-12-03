-- Adicionar coluna midia_id na tabela comunicados para vincular com midias
ALTER TABLE public.comunicados 
ADD COLUMN IF NOT EXISTS midia_id uuid REFERENCES public.midias(id);

-- PASSO 1: Copiar as imagens de comunicados para midias (sem duplicar)
INSERT INTO public.midias (titulo, url, tipo, canal, ativo, created_at)
SELECT 
    titulo,
    imagem_url,
    'imagem',
    'telao',
    true,
    created_at
FROM public.comunicados
WHERE 
    imagem_url IS NOT NULL 
    AND imagem_url != ''
    AND NOT EXISTS (
        SELECT 1 FROM public.midias m WHERE m.url = public.comunicados.imagem_url
    );

-- PASSO 2: Fazer a amarração (vincular os IDs)
UPDATE public.comunicados c
SET midia_id = m.id
FROM public.midias m
WHERE 
    c.imagem_url = m.url
    AND c.midia_id IS NULL;
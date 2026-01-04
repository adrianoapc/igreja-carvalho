-- Migration 1: Cadastros base (bases_ministeriais, categorias_financeiras, formas_pagamento)

-- bases_ministeriais
ALTER TABLE public.bases_ministeriais 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.bases_ministeriais 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
ALTER TABLE public.bases_ministeriais
  ADD CONSTRAINT bases_ministeriais_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
CREATE INDEX IF NOT EXISTS idx_bases_ministeriais_igreja_id 
  ON public.bases_ministeriais(igreja_id);

-- categorias_financeiras
ALTER TABLE public.categorias_financeiras 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.categorias_financeiras 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
ALTER TABLE public.categorias_financeiras
  ADD CONSTRAINT categorias_financeiras_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
CREATE INDEX IF NOT EXISTS idx_categorias_financeiras_igreja_id 
  ON public.categorias_financeiras(igreja_id);

-- formas_pagamento
ALTER TABLE public.formas_pagamento 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.formas_pagamento 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
ALTER TABLE public.formas_pagamento
  ADD CONSTRAINT formas_pagamento_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
CREATE INDEX IF NOT EXISTS idx_formas_pagamento_igreja_id 
  ON public.formas_pagamento(igreja_id);
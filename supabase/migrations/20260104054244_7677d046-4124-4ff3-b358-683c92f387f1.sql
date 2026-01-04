-- Migration 2: Cadastros com dependências (subcategorias_financeiras, centros_custo, contas, fornecedores)

-- subcategorias_financeiras
ALTER TABLE public.subcategorias_financeiras 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.subcategorias_financeiras 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
ALTER TABLE public.subcategorias_financeiras
  ADD CONSTRAINT subcategorias_financeiras_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
CREATE INDEX IF NOT EXISTS idx_subcategorias_financeiras_igreja_id 
  ON public.subcategorias_financeiras(igreja_id);

-- centros_custo
ALTER TABLE public.centros_custo 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.centros_custo 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
ALTER TABLE public.centros_custo
  ADD CONSTRAINT centros_custo_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
CREATE INDEX IF NOT EXISTS idx_centros_custo_igreja_id 
  ON public.centros_custo(igreja_id);

-- contas
ALTER TABLE public.contas 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.contas 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
ALTER TABLE public.contas
  ADD CONSTRAINT contas_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
CREATE INDEX IF NOT EXISTS idx_contas_igreja_id 
  ON public.contas(igreja_id);

-- fornecedores
ALTER TABLE public.fornecedores 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.fornecedores 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
ALTER TABLE public.fornecedores
  ADD CONSTRAINT fornecedores_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_igreja_id 
  ON public.fornecedores(igreja_id);
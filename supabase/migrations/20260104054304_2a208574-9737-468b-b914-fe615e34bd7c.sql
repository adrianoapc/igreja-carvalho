-- Migration 3: Transações financeiras

ALTER TABLE public.transacoes_financeiras 
  ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.transacoes_financeiras 
  SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1)
  WHERE igreja_id IS NULL;
ALTER TABLE public.transacoes_financeiras
  ADD CONSTRAINT transacoes_financeiras_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
CREATE INDEX IF NOT EXISTS idx_transacoes_financeiras_igreja_id 
  ON public.transacoes_financeiras(igreja_id);

-- Migration 4: Adicionar FK nas tabelas que já têm coluna

-- solicitacoes_reembolso (já tem coluna, falta FK)
ALTER TABLE public.solicitacoes_reembolso
  DROP CONSTRAINT IF EXISTS solicitacoes_reembolso_igreja_id_fkey;
ALTER TABLE public.solicitacoes_reembolso
  ADD CONSTRAINT solicitacoes_reembolso_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- itens_reembolso (já tem coluna, falta FK)
ALTER TABLE public.itens_reembolso
  DROP CONSTRAINT IF EXISTS itens_reembolso_igreja_id_fkey;
ALTER TABLE public.itens_reembolso
  ADD CONSTRAINT itens_reembolso_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
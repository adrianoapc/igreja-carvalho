-- Tabela que liga um ITEM DA LITURGIA a uma ou mais MÍDIAS
CREATE TABLE public.liturgia_recursos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- O item da liturgia (pai)
  liturgia_item_id UUID NOT NULL REFERENCES public.liturgia_culto(id) ON DELETE CASCADE,
  
  -- A mídia vinculada
  midia_id UUID NOT NULL REFERENCES public.midias(id) ON DELETE CASCADE,
  
  -- Ordenação interna (playlist)
  ordem INTEGER DEFAULT 0,
  duracao_segundos INTEGER DEFAULT 10,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.liturgia_recursos ENABLE ROW LEVEL SECURITY;

-- Admins podem gerenciar recursos de liturgia
CREATE POLICY "Admins podem gerenciar recursos liturgia" 
ON public.liturgia_recursos 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Membros podem visualizar recursos
CREATE POLICY "Membros podem ver recursos liturgia" 
ON public.liturgia_recursos 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Índice para performance
CREATE INDEX idx_liturgia_recursos_item ON public.liturgia_recursos(liturgia_item_id);
CREATE INDEX idx_liturgia_recursos_midia ON public.liturgia_recursos(midia_id);
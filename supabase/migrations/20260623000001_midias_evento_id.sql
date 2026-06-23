-- Adiciona FK evento_id na tabela midias
ALTER TABLE public.midias
  ADD COLUMN IF NOT EXISTS evento_id UUID REFERENCES public.eventos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.midias.evento_id IS
  'Evento ao qual esta mídia está vinculada (opcional)';

CREATE INDEX IF NOT EXISTS idx_midias_evento_id ON public.midias(evento_id)
  WHERE evento_id IS NOT NULL;

-- Notificar PostgREST do schema atualizado
NOTIFY pgrst, 'reload schema';

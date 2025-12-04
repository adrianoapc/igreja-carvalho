-- Adiciona campos de status de confirmação na tabela escalas_culto
ALTER TABLE public.escalas_culto 
ADD COLUMN IF NOT EXISTS status_confirmacao TEXT DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS motivo_recusa TEXT;

-- Comentário explicativo
COMMENT ON COLUMN public.escalas_culto.status_confirmacao IS 'Status: pendente, aceito, recusado';
COMMENT ON COLUMN public.escalas_culto.motivo_recusa IS 'Motivo caso o voluntário recuse a escala';

-- Política para o voluntário poder atualizar o próprio status de confirmação
CREATE POLICY "Voluntario atualiza seu status confirmacao" ON public.escalas_culto
FOR UPDATE
USING (
  pessoa_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  pessoa_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);
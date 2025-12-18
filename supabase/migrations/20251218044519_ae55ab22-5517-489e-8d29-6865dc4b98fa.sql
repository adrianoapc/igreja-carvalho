-- Permitir que membros autenticados se inscrevam em jornadas
CREATE POLICY "Membros podem se inscrever em jornadas"
ON public.inscricoes_jornada
FOR INSERT
TO authenticated
WITH CHECK (
  pessoa_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  )
);
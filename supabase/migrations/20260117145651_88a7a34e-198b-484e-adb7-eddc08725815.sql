-- Allow super_admin to manage bank statements

ALTER TABLE public.extratos_bancarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver extratos bancarios" ON public.extratos_bancarios;
CREATE POLICY "Ver extratos bancarios"
ON public.extratos_bancarios
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'super_admin'::app_role)
   OR has_role(auth.uid(), 'admin'::app_role)
   OR has_role(auth.uid(), 'tesoureiro'::app_role))
  AND (igreja_id = get_jwt_igreja_id())
);

DROP POLICY IF EXISTS "Inserir extratos bancarios" ON public.extratos_bancarios;
CREATE POLICY "Inserir extratos bancarios"
ON public.extratos_bancarios
FOR INSERT
TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'super_admin'::app_role)
   OR has_role(auth.uid(), 'admin'::app_role)
   OR has_role(auth.uid(), 'tesoureiro'::app_role))
  AND (igreja_id = get_jwt_igreja_id())
);

DROP POLICY IF EXISTS "Atualizar extratos bancarios" ON public.extratos_bancarios;
CREATE POLICY "Atualizar extratos bancarios"
ON public.extratos_bancarios
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'super_admin'::app_role)
   OR has_role(auth.uid(), 'admin'::app_role)
   OR has_role(auth.uid(), 'tesoureiro'::app_role))
  AND (igreja_id = get_jwt_igreja_id())
)
WITH CHECK (
  (has_role(auth.uid(), 'super_admin'::app_role)
   OR has_role(auth.uid(), 'admin'::app_role)
   OR has_role(auth.uid(), 'tesoureiro'::app_role))
  AND (igreja_id = get_jwt_igreja_id())
);

DROP POLICY IF EXISTS "Deletar extratos bancarios" ON public.extratos_bancarios;
CREATE POLICY "Deletar extratos bancarios"
ON public.extratos_bancarios
FOR DELETE
TO authenticated
USING (
  (has_role(auth.uid(), 'super_admin'::app_role)
   OR has_role(auth.uid(), 'admin'::app_role))
  AND (igreja_id = get_jwt_igreja_id())
);

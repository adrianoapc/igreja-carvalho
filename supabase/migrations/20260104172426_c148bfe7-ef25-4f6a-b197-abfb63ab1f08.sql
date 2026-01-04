-- Adicionar permissões para gerenciamento de filiais
INSERT INTO public.app_permissions (key, name, module, description) VALUES
  ('filiais.view', 'Visualizar Filiais', 'filiais', 'Permite visualizar a lista de filiais da igreja'),
  ('filiais.manage', 'Gerenciar Filiais', 'filiais', 'Permite criar, editar e excluir filiais da igreja')
ON CONFLICT (key) DO NOTHING;

-- Vincular permissão filiais.manage ao role admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.app_roles r
CROSS JOIN public.app_permissions p
WHERE r.name = 'admin' AND p.key = 'filiais.manage'
ON CONFLICT DO NOTHING;

-- Vincular permissão filiais.manage ao role pastor (opcional - para gestão de filiais)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.app_roles r
CROSS JOIN public.app_permissions p
WHERE r.name = 'pastor' AND p.key = 'filiais.view'
ON CONFLICT DO NOTHING;

-- RLS Policy para filiais - garantir que admin da igreja possa gerenciar suas filiais
-- Verificar se a policy já existe antes de criar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Igreja admin pode gerenciar filiais' AND tablename = 'filiais'
  ) THEN
    CREATE POLICY "Igreja admin pode gerenciar filiais"
      ON public.filiais
      FOR ALL
      TO authenticated
      USING (
        -- Super admin tem acesso total
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
        )
        OR
        -- Admin da igreja pode gerenciar filiais da sua igreja
        (
          igreja_id IN (
            SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid()
          )
          AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'pastor')
          )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
        )
        OR
        (
          igreja_id IN (
            SELECT p.igreja_id FROM public.profiles p WHERE p.user_id = auth.uid()
          )
          AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'pastor')
          )
        )
      );
  END IF;
END $$;
-- Adicionar filial_id às tabelas operacionais
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'igreja_id'
      AND table_name NOT IN (
        'igrejas',
        'filiais',
        'configuracoes_igreja',
        'app_config',
        'module_permissions',
        'app_permissions',
        'app_roles',
        'role_permissions',
        'role_permissions_audit',
        'user_roles',
        'user_app_roles'
      )
  LOOP
    -- Adicionar coluna se não existir
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS filial_id UUID;', r.table_name);
    
    -- Definir valor default
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN filial_id SET DEFAULT public.get_current_user_filial_id();', r.table_name);
    
    -- Preencher dados existentes com filial padrão
    EXECUTE format('UPDATE public.%I SET filial_id = public.get_default_filial_id(igreja_id) WHERE filial_id IS NULL AND igreja_id IS NOT NULL;', r.table_name);
    
    -- Criar índice
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(filial_id);',
      'idx_' || r.table_name || '_filial_id',
      r.table_name
    );
  END LOOP;
END $$;
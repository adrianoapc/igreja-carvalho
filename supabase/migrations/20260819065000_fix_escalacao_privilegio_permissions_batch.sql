-- Corrige escalação de privilégio: save_permissions_batch e rollback_audit_batch
-- eram SECURITY DEFINER sem NENHUM check de role, expostas via RPC a anon/authenticated,
-- e chamadas pelo frontend (/admin/permissoes) atrás de um <AuthGate> sem requiredPermission.
-- Qualquer usuário autenticado podia reescrever role_permissions (matriz global de
-- capacidades por role, sem igreja_id — afeta TODOS os tenants) via devtools.
-- role_permissions/app_roles/app_permissions são tabelas globais (fora do loop de
-- filial_id em 20260... has_filial_access), então o gate correto é super_admin,
-- no mesmo padrão de public.get_super_admin_dashboard / public.aprovar_onboarding.

CREATE OR REPLACE FUNCTION public.save_permissions_batch(
  p_request_id uuid,
  p_inserts jsonb,
  p_deletes jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado: requer papel super_admin' USING ERRCODE = '42501';
  END IF;

  -- 1. Define o Contexto de Auditoria (dentro da mesma transação!)
  PERFORM set_config('app.request_id', p_request_id::text, true);
  PERFORM set_config('app.source', 'admin-ui', true);

  -- 2. Processar Remoções
  IF p_deletes IS NOT NULL THEN
    FOR item IN SELECT * FROM jsonb_array_elements(p_deletes)
    LOOP
      DELETE FROM public.role_permissions
      WHERE role_id = (item->>'role_id')::bigint
      AND permission_id = (item->>'permission_id')::bigint;
    END LOOP;
  END IF;

  -- 3. Processar Inserções
  IF p_inserts IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT
      (value->>'role_id')::bigint,
      (value->>'permission_id')::bigint
    FROM jsonb_array_elements(p_inserts);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rollback_audit_batch(target_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  new_request_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado: requer papel super_admin' USING ERRCODE = '42501';
  END IF;

  -- Gera um ID novo para registrar essa ação de rollback no histórico
  new_request_id := gen_random_uuid();
  PERFORM set_config('app.request_id', new_request_id::text, true);
  PERFORM set_config('app.source', 'rollback', true);

  -- Percorre todos os itens do lote original
  FOR r IN SELECT * FROM public.role_permissions_audit WHERE request_id = target_request_id
  LOOP
    IF r.action = 'INSERT' THEN
      -- Se foi inserido, agora removemos
      DELETE FROM public.role_permissions
      WHERE role_id = r.role_id AND permission_id = r.permission_id;

    ELSIF r.action = 'DELETE' THEN
      -- Se foi deletado, agora inserimos de volta
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (r.role_id, r.permission_id)
      ON CONFLICT DO NOTHING; -- Segurança caso já exista
    END IF;
  END LOOP;
END;
$$;

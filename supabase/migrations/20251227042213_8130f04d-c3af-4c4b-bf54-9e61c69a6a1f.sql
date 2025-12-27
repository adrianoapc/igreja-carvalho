-- Função para reverter um lote de alterações de permissões pelo request_id
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
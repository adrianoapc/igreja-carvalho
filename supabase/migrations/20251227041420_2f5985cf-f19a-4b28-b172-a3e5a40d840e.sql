-- Função para salvar permissões em lote com contexto de auditoria
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
-- Fix SECURITY DEFINER functions to add authorization checks

-- 1. Update get_user_familia_id to verify auth.uid() matches input
CREATE OR REPLACE FUNCTION public.get_user_familia_id(_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Security: Only allow users to query their own familia_id
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF auth.uid() != _user_id THEN
    -- Allow admins to query any user's familia_id
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Access denied: can only query own familia_id';
    END IF;
  END IF;
  
  RETURN (SELECT familia_id FROM public.profiles WHERE user_id = _user_id LIMIT 1);
END;
$function$;

-- 2. Update alocar_pedido_balanceado to require admin/intercessor role
CREATE OR REPLACE FUNCTION public.alocar_pedido_balanceado(p_pedido_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_intercessor_id UUID;
BEGIN
  -- Security: Only allow admin or users with intercessor role
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Check if user is admin or has intercessor privileges
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'pastor'::app_role) OR
    EXISTS (SELECT 1 FROM public.intercessores WHERE user_id = auth.uid() AND ativo = true)
  ) THEN
    RAISE EXCEPTION 'Access denied: requires admin, pastor, or intercessor role';
  END IF;

  SELECT i.id INTO v_intercessor_id
  FROM public.intercessores i
  LEFT JOIN (
    SELECT intercessor_id, COUNT(*) as total_pedidos
    FROM public.pedidos_oracao
    WHERE status IN ('pendente', 'em_oracao')
    GROUP BY intercessor_id
  ) p ON i.id = p.intercessor_id
  WHERE i.ativo = true
    AND (p.total_pedidos IS NULL OR p.total_pedidos < i.max_pedidos)
  ORDER BY COALESCE(p.total_pedidos, 0) ASC, i.created_at ASC
  LIMIT 1;
  
  IF v_intercessor_id IS NOT NULL THEN
    UPDATE public.pedidos_oracao
    SET 
      intercessor_id = v_intercessor_id,
      status = 'em_oracao',
      data_alocacao = now()
    WHERE id = p_pedido_id;
  END IF;
  
  RETURN v_intercessor_id;
END;
$function$;

-- 3. Update buscar_pessoa_por_contato to require authentication
-- This function is used by edge functions which already validate auth tokens
-- Adding a check here provides defense in depth
CREATE OR REPLACE FUNCTION public.buscar_pessoa_por_contato(p_nome text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_telefone text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pessoa_id uuid;
BEGIN
  -- Security: Require authentication for person lookup
  -- Note: Edge functions already validate auth, this is defense in depth
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_email IS NOT NULL THEN
    SELECT id INTO v_pessoa_id
    FROM public.profiles
    WHERE LOWER(email) = LOWER(p_email)
    LIMIT 1;
    
    IF v_pessoa_id IS NOT NULL THEN
      RETURN v_pessoa_id;
    END IF;
  END IF;
  
  IF p_telefone IS NOT NULL THEN
    SELECT id INTO v_pessoa_id
    FROM public.profiles
    WHERE REGEXP_REPLACE(telefone, '[^0-9]', '', 'g') = REGEXP_REPLACE(p_telefone, '[^0-9]', '', 'g')
    LIMIT 1;
    
    IF v_pessoa_id IS NOT NULL THEN
      RETURN v_pessoa_id;
    END IF;
  END IF;
  
  IF p_nome IS NOT NULL THEN
    SELECT id INTO v_pessoa_id
    FROM public.profiles
    WHERE LOWER(nome) = LOWER(p_nome)
    LIMIT 1;
    
    IF v_pessoa_id IS NOT NULL THEN
      RETURN v_pessoa_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$function$;
-- Fix search_path for mask_cpf_cnpj function to prevent SQL injection
CREATE OR REPLACE FUNCTION public.mask_cpf_cnpj(cpf_cnpj text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
BEGIN
  IF cpf_cnpj IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Mascarar: mostrar apenas primeiros 3 e últimos 2 dígitos
  RETURN SUBSTRING(cpf_cnpj FROM 1 FOR 3) || '***' || 
         SUBSTRING(cpf_cnpj FROM LENGTH(cpf_cnpj) - 1 FOR 2);
END;
$function$;
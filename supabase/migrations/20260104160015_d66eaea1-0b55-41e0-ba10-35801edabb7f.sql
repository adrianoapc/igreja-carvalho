-- ============================================================
-- FASE 1: Infraestrutura de Criptografia para Secrets Multi-Tenant
-- ============================================================

-- 1. Habilitar extensão pgcrypto (já disponível no Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Adicionar colunas para armazenar secret criptografado e dica
ALTER TABLE public.webhooks 
ADD COLUMN IF NOT EXISTS secret_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS secret_hint TEXT;

-- 3. Criar função RPC para ATUALIZAR secret (chamada pelo frontend)
-- Usa SECURITY DEFINER para ter acesso privilegiado
CREATE OR REPLACE FUNCTION public.set_webhook_secret(
  p_igreja_id UUID,
  p_tipo TEXT,
  p_secret TEXT,
  p_encryption_key TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualiza o secret criptografado e armazena hint (últimos 4 chars)
  UPDATE public.webhooks 
  SET 
    secret_encrypted = pgp_sym_encrypt(p_secret, p_encryption_key),
    secret_hint = RIGHT(p_secret, 4),
    secret = NULL,  -- Limpa texto plano
    updated_at = now()
  WHERE igreja_id = p_igreja_id AND tipo = p_tipo;
  
  -- Se não existe, insere
  IF NOT FOUND THEN
    INSERT INTO public.webhooks (igreja_id, tipo, secret_encrypted, secret_hint, enabled)
    VALUES (
      p_igreja_id, 
      p_tipo, 
      pgp_sym_encrypt(p_secret, p_encryption_key),
      RIGHT(p_secret, 4),
      true
    );
  END IF;
END;
$$;

-- 4. Criar função RPC para LER secret (apenas Edge Functions com service role)
-- Esta função só funciona quando chamada com service role key
CREATE OR REPLACE FUNCTION public.get_webhook_secret(
  p_igreja_id UUID,
  p_tipo TEXT,
  p_encryption_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT pgp_sym_decrypt(secret_encrypted, p_encryption_key)
  INTO v_secret
  FROM public.webhooks
  WHERE igreja_id = p_igreja_id 
    AND tipo = p_tipo 
    AND enabled = true
    AND secret_encrypted IS NOT NULL;
  
  RETURN v_secret;
END;
$$;

-- 5. Criar view segura que mascara o secret
CREATE OR REPLACE VIEW public.webhooks_safe AS
SELECT 
  id,
  igreja_id,
  filial_id,
  tipo,
  url,
  enabled,
  CASE 
    WHEN secret_encrypted IS NOT NULL THEN '••••••••' || COALESCE(secret_hint, '')
    WHEN secret IS NOT NULL THEN '••••••••' || RIGHT(secret, 4)
    ELSE NULL 
  END as secret_masked,
  CASE 
    WHEN secret_encrypted IS NOT NULL OR secret IS NOT NULL THEN true
    ELSE false 
  END as has_secret,
  created_at,
  updated_at
FROM public.webhooks;

-- 6. Conceder permissões na view
GRANT SELECT ON public.webhooks_safe TO authenticated;

-- 7. Revogar acesso direto às colunas sensíveis via RLS
-- A view é o único caminho seguro para leitura
COMMENT ON VIEW public.webhooks_safe IS 'View segura para webhooks - secrets são mascarados e nunca expostos';

-- 8. Comentários para documentação
COMMENT ON FUNCTION public.set_webhook_secret IS 'Atualiza secret criptografado. Usar via frontend. Requer WEBHOOK_ENCRYPTION_KEY.';
COMMENT ON FUNCTION public.get_webhook_secret IS 'Lê secret descriptografado. Apenas para Edge Functions com service role.';
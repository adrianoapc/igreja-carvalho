-- ============================================
-- AUDIT LOG PARA ALTERAÇÕES DE PERMISSÕES (RBAC)
-- ============================================

-- 1. Criar tabela de auditoria
CREATE TABLE IF NOT EXISTS public.role_permissions_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  actor_user_id uuid NULL,
  actor_email text NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'DELETE', 'UPDATE')),
  role_id bigint NOT NULL,
  permission_id bigint NOT NULL,
  old_row jsonb NULL,
  new_row jsonb NULL,
  source text NULL,
  request_id uuid NULL
);

-- Índices para consultas
CREATE INDEX IF NOT EXISTS idx_role_permissions_audit_created_at ON public.role_permissions_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_permissions_audit_request_id ON public.role_permissions_audit(request_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_audit_actor ON public.role_permissions_audit(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_audit_role ON public.role_permissions_audit(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_audit_permission ON public.role_permissions_audit(permission_id);

-- 2. Habilitar RLS
ALTER TABLE public.role_permissions_audit ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS: somente admin pode SELECT, ninguém pode INSERT/UPDATE/DELETE diretamente
DO $$
BEGIN
  -- Policy para SELECT (somente admins)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'role_permissions_audit' 
    AND policyname = 'Admins podem ver auditoria de permissões'
  ) THEN
    CREATE POLICY "Admins podem ver auditoria de permissões"
      ON public.role_permissions_audit
      FOR SELECT
      USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;

  -- Policy para bloquear INSERT direto (trigger usa SECURITY DEFINER)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'role_permissions_audit' 
    AND policyname = 'Ninguém pode inserir auditoria diretamente'
  ) THEN
    CREATE POLICY "Ninguém pode inserir auditoria diretamente"
      ON public.role_permissions_audit
      FOR INSERT
      WITH CHECK (false);
  END IF;

  -- Policy para bloquear UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'role_permissions_audit' 
    AND policyname = 'Ninguém pode atualizar auditoria'
  ) THEN
    CREATE POLICY "Ninguém pode atualizar auditoria"
      ON public.role_permissions_audit
      FOR UPDATE
      USING (false)
      WITH CHECK (false);
  END IF;

  -- Policy para bloquear DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'role_permissions_audit' 
    AND policyname = 'Ninguém pode deletar auditoria'
  ) THEN
    CREATE POLICY "Ninguém pode deletar auditoria"
      ON public.role_permissions_audit
      FOR DELETE
      USING (false);
  END IF;
END$$;

-- 4. Função de logging (SECURITY DEFINER para bypass RLS)
CREATE OR REPLACE FUNCTION public.log_role_permissions_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_email text;
  v_request_id uuid;
  v_action text;
  v_old_row jsonb := NULL;
  v_new_row jsonb := NULL;
  v_role_id bigint;
  v_permission_id bigint;
BEGIN
  -- Captura o usuário que fez a alteração
  v_actor_id := auth.uid();
  
  -- Busca o email do ator (se houver user_id)
  IF v_actor_id IS NOT NULL THEN
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = v_actor_id;
  END IF;
  
  -- Tenta ler request_id do contexto da sessão
  BEGIN
    v_request_id := current_setting('app.request_id', true)::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_request_id := NULL;
  END;
  
  -- Define ação e valores baseado no tipo de operação
  IF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_new_row := to_jsonb(NEW);
    v_role_id := NEW.role_id;
    v_permission_id := NEW.permission_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_old_row := to_jsonb(OLD);
    v_role_id := OLD.role_id;
    v_permission_id := OLD.permission_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_old_row := to_jsonb(OLD);
    v_new_row := to_jsonb(NEW);
    v_role_id := NEW.role_id;
    v_permission_id := NEW.permission_id;
  END IF;
  
  -- Insere o registro de auditoria
  INSERT INTO public.role_permissions_audit (
    actor_user_id,
    actor_email,
    action,
    role_id,
    permission_id,
    old_row,
    new_row,
    source,
    request_id
  ) VALUES (
    v_actor_id,
    v_actor_email,
    v_action,
    v_role_id,
    v_permission_id,
    v_old_row,
    v_new_row,
    current_setting('app.source', true),
    v_request_id
  );
  
  -- Retorna apropriadamente
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- 5. Criar trigger na tabela role_permissions
DROP TRIGGER IF EXISTS trg_audit_role_permissions ON public.role_permissions;

CREATE TRIGGER trg_audit_role_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_role_permissions_changes();

-- 6. Função RPC para definir request_id e source no contexto da sessão
CREATE OR REPLACE FUNCTION public.set_audit_context(p_request_id uuid, p_source text DEFAULT 'admin-ui')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Define variáveis de sessão para uso pelo trigger de auditoria
  PERFORM set_config('app.request_id', p_request_id::text, true);
  PERFORM set_config('app.source', COALESCE(p_source, 'admin-ui'), true);
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.set_audit_context(uuid, text) TO authenticated;
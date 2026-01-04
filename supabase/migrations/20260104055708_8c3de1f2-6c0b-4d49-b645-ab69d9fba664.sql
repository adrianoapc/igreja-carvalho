-- =====================================================
-- MIGRAÇÃO Parte 1B: Funções de escopo
-- =====================================================

-- Atualizar função has_role para considerar admins por igreja/filial
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
  OR (
    _role = 'admin'::public.app_role
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id AND role IN ('admin_igreja'::public.app_role, 'admin_filial'::public.app_role)
    )
  )
$$;

-- Helpers para claims JWT
CREATE OR REPLACE FUNCTION public.get_jwt_igreja_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'igreja_id'), '')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.get_jwt_filial_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.filial_id', true), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'filial_id'), '')::uuid
  );
$$;

-- Atualizar helper de igreja para considerar JWT
CREATE OR REPLACE FUNCTION public.get_current_user_igreja_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE(
    public.get_jwt_igreja_id(),
    (
      SELECT igreja_id
      FROM public.profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );
END;
$$;

-- Helper de filial
CREATE OR REPLACE FUNCTION public.get_current_user_filial_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN COALESCE(
    public.get_jwt_filial_id(),
    (
      SELECT filial_id
      FROM public.profiles
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );
END;
$$;

-- Função de escopo por igreja/filial
CREATE OR REPLACE FUNCTION public.has_filial_access(_igreja_id UUID, _filial_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role(auth.uid(), 'admin'::app_role)
    OR (
      _igreja_id = public.get_jwt_igreja_id()
      AND (
        has_role(auth.uid(), 'admin_igreja'::app_role)
        OR (
          public.get_jwt_filial_id() IS NOT NULL
          AND _filial_id = public.get_jwt_filial_id()
        )
      )
    );
$$;
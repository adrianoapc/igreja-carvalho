-- Fix JWT claim extraction for multi-tenant context
-- Our client JWT stores igreja_id/filial_id inside app_metadata/user_metadata.

CREATE OR REPLACE FUNCTION public.get_jwt_igreja_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.igreja_id', true), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'igreja_id'), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb #>> '{app_metadata,igreja_id}'), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb #>> '{user_metadata,igreja_id}'), '')::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.get_jwt_filial_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.filial_id', true), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'filial_id'), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb #>> '{app_metadata,filial_id}'), '')::uuid,
    nullif((current_setting('request.jwt.claims', true)::jsonb #>> '{user_metadata,filial_id}'), '')::uuid
  );
$$;

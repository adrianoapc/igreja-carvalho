-- Migração para corrigir metadados JWT: mover igreja_id e filial_id de user_metadata para app_metadata
-- Esta migração corrige um problema de arquitetura onde dados gerenciados pela aplicação
-- estavam sendo armazenados no user_metadata (cliente) ao invés do app_metadata (servidor)

DO $$
DECLARE
    user_record RECORD;
BEGIN
  -- Para cada usuário que tem igreja_id no user_metadata
  FOR user_record IN
    SELECT
      id,
      raw_user_meta_data
    FROM auth.users
    WHERE raw_user_meta_data->>'igreja_id' IS NOT NULL
       OR raw_user_meta_data->>'filial_id' IS NOT NULL
  LOOP
    -- Atualizar app_metadata com os valores do user_metadata
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object(
        'igreja_id', user_record.raw_user_meta_data->>'igreja_id',
        'filial_id', user_record.raw_user_meta_data->>'filial_id'
      )
    WHERE id = user_record.id;

    RAISE NOTICE 'Atualizado metadados para usuário %', user_record.id;
  END LOOP;

  RAISE NOTICE 'Migração de metadados JWT concluída';
END $$;

-- Criar função para sincronizar metadados JWT quando o perfil for atualizado
CREATE OR REPLACE FUNCTION public.sync_user_jwt_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se igreja_id ou filial_id foram alterados no perfil, atualizar app_metadata
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND
     (NEW.igreja_id IS NOT NULL OR NEW.filial_id IS NOT NULL) AND
     NEW.user_id IS NOT NULL THEN

    -- Atualizar app_metadata do usuário
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object(
        'igreja_id', NEW.igreja_id::text,
        'filial_id', NEW.filial_id::text
      )
    WHERE id = NEW.user_id;

    RAISE NOTICE 'Sincronizado metadados JWT para usuário %', NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_user_jwt_metadata IS 'Sincroniza igreja_id e filial_id do profile para app_metadata do usuário JWT';

-- Criar trigger para manter metadados JWT sincronizados
DROP TRIGGER IF EXISTS sync_jwt_metadata_on_profile_change ON public.profiles;
CREATE TRIGGER sync_jwt_metadata_on_profile_change
  AFTER INSERT OR UPDATE OF igreja_id, filial_id, user_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_jwt_metadata();
-- Primeiro criar UNIQUE constraint para user_id na tabela intercessores
ALTER TABLE public.intercessores DROP CONSTRAINT IF EXISTS intercessores_user_id_key;
ALTER TABLE public.intercessores ADD CONSTRAINT intercessores_user_id_key UNIQUE (user_id);

-- Backfill: para membros que já estão no time de Intercessão e já possuem user_id
INSERT INTO public.intercessores (user_id, nome, email, telefone, ativo, max_pedidos)
SELECT DISTINCT
  p.user_id,
  p.nome,
  p.email,
  p.telefone,
  true,
  10
FROM public.membros_time mt
JOIN public.times_culto tc ON tc.id = mt.time_id
JOIN public.profiles p ON p.id = mt.pessoa_id
WHERE
  p.user_id IS NOT NULL
  AND mt.ativo = true
  AND (
    tc.nome ILIKE '%Intercessão%' OR
    tc.nome ILIKE '%Oração%' OR
    tc.nome ILIKE '%Clamor%'
  )
ON CONFLICT (user_id) DO UPDATE
SET
  ativo = true,
  nome = EXCLUDED.nome,
  email = EXCLUDED.email,
  telefone = EXCLUDED.telefone;

-- Função: quando um profile recebe user_id, verificar se ele já está em time de intercessão
CREATE OR REPLACE FUNCTION public.sync_profile_intercessor_on_user_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (OLD.user_id IS NULL AND NEW.user_id IS NOT NULL) THEN
    IF EXISTS (
      SELECT 1
      FROM public.membros_time mt
      JOIN public.times_culto tc ON tc.id = mt.time_id
      WHERE mt.pessoa_id = NEW.id
        AND mt.ativo = true
        AND (
          tc.nome ILIKE '%Intercessão%' OR
          tc.nome ILIKE '%Oração%' OR
          tc.nome ILIKE '%Clamor%'
        )
    ) THEN
      INSERT INTO public.intercessores (user_id, nome, email, telefone, ativo, max_pedidos)
      VALUES (NEW.user_id, NEW.nome, NEW.email, NEW.telefone, true, 10)
      ON CONFLICT (user_id) DO UPDATE
      SET
        ativo = true,
        nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        telefone = EXCLUDED.telefone;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger: roda após update de profiles
DROP TRIGGER IF EXISTS trigger_sync_profile_intercessor_user_link ON public.profiles;
CREATE TRIGGER trigger_sync_profile_intercessor_user_link
AFTER UPDATE OF user_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_intercessor_on_user_link();
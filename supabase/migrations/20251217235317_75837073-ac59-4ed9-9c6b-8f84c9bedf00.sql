-- 1. Função que sincroniza Membro de Time -> Tabela Intercessores
CREATE OR REPLACE FUNCTION public.sync_membro_intercessor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_time_nome TEXT;
  v_user_id UUID;
  v_user_nome TEXT;
  v_user_email TEXT;
  v_user_telefone TEXT;
BEGIN
  -- Descobre o nome do time onde a pessoa entrou
  SELECT nome INTO v_time_nome FROM public.times_culto WHERE id = NEW.time_id;

  -- VERIFICAÇÃO INTELIGENTE:
  -- Se o nome do time contém "Intercessão", "Oração" ou "Clamor"
  IF v_time_nome ILIKE '%Intercessão%' OR v_time_nome ILIKE '%Oração%' OR v_time_nome ILIKE '%Clamor%' THEN
    
    -- Busca os dados do perfil do membro
    SELECT user_id, nome, email, telefone 
    INTO v_user_id, v_user_nome, v_user_email, v_user_telefone
    FROM public.profiles 
    WHERE id = NEW.pessoa_id;

    -- Só cadastra se a pessoa tiver um Login de Sistema (user_id não nulo)
    IF v_user_id IS NOT NULL THEN
      -- Insere na tabela especializada de intercessores
      INSERT INTO public.intercessores (user_id, nome, email, telefone, ativo, max_pedidos)
      VALUES (v_user_id, v_user_nome, v_user_email, v_user_telefone, true, 10)
      ON CONFLICT (user_id) DO UPDATE SET ativo = true;
    END IF;
    
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Gatilho para Adição (Entrou no time -> Vira intercessor)
DROP TRIGGER IF EXISTS trigger_sync_intercessor_insert ON public.membros_time;
CREATE TRIGGER trigger_sync_intercessor_insert
  AFTER INSERT ON public.membros_time
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_membro_intercessor();

-- 3. Função para remoção (Saiu do time -> Desativa intercessor)
CREATE OR REPLACE FUNCTION public.sync_remove_intercessor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_time_nome TEXT;
  v_user_id UUID;
BEGIN
  SELECT nome INTO v_time_nome FROM public.times_culto WHERE id = OLD.time_id;

  IF v_time_nome ILIKE '%Intercessão%' OR v_time_nome ILIKE '%Oração%' OR v_time_nome ILIKE '%Clamor%' THEN
    SELECT user_id INTO v_user_id FROM public.profiles WHERE id = OLD.pessoa_id;
    
    IF v_user_id IS NOT NULL THEN
      UPDATE public.intercessores SET ativo = false WHERE user_id = v_user_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

-- 4. Gatilho para Remoção
DROP TRIGGER IF EXISTS trigger_sync_intercessor_delete ON public.membros_time;
CREATE TRIGGER trigger_sync_intercessor_delete
  AFTER DELETE ON public.membros_time
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_remove_intercessor();
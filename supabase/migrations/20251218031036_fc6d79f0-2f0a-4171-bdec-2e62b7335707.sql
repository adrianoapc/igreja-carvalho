-- 1. Garantir que existe um time "Liturgia" para associar escalas automáticas
INSERT INTO public.times_culto (nome, categoria, descricao, ativo, cor)
VALUES ('Liturgia', 'Geral', 'Time automático para responsáveis de itens da liturgia', true, '#8B5CF6')
ON CONFLICT DO NOTHING;

-- 2. Criar função que sincroniza responsável da liturgia com escalas
CREATE OR REPLACE FUNCTION public.sync_liturgia_responsavel_to_escala()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_time_liturgia_id UUID;
  v_escala_existente UUID;
BEGIN
  -- Só processa se responsavel_id está preenchido (não é convidado externo)
  IF NEW.responsavel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Busca o ID do time "Liturgia"
  SELECT id INTO v_time_liturgia_id
  FROM public.times_culto
  WHERE nome = 'Liturgia'
  LIMIT 1;

  -- Se não encontrou o time, não faz nada
  IF v_time_liturgia_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verifica se já existe escala para essa pessoa nesse culto
  SELECT id INTO v_escala_existente
  FROM public.escalas_culto
  WHERE culto_id = NEW.culto_id
    AND pessoa_id = NEW.responsavel_id
  LIMIT 1;

  -- Se não existe, cria a escala
  IF v_escala_existente IS NULL THEN
    INSERT INTO public.escalas_culto (
      culto_id,
      pessoa_id,
      time_id,
      observacoes,
      status_confirmacao
    )
    VALUES (
      NEW.culto_id,
      NEW.responsavel_id,
      v_time_liturgia_id,
      'Liturgia: ' || NEW.titulo,
      'confirmado'
    );
  ELSE
    -- Se já existe, atualiza observações para incluir item da liturgia
    UPDATE public.escalas_culto
    SET observacoes = COALESCE(observacoes, '') || 
        CASE WHEN observacoes IS NOT NULL AND observacoes != '' THEN ' | ' ELSE '' END ||
        'Liturgia: ' || NEW.titulo
    WHERE id = v_escala_existente;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Criar trigger para INSERT na liturgia_culto
DROP TRIGGER IF EXISTS trigger_sync_liturgia_to_escala ON public.liturgia_culto;
CREATE TRIGGER trigger_sync_liturgia_to_escala
  AFTER INSERT OR UPDATE OF responsavel_id ON public.liturgia_culto
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_liturgia_responsavel_to_escala();

-- 4. Criar função para remover escala quando responsável é removido da liturgia
CREATE OR REPLACE FUNCTION public.cleanup_liturgia_escala()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_time_liturgia_id UUID;
  v_outros_itens INTEGER;
BEGIN
  -- Só processa se tinha responsável antes e agora não tem mais
  IF OLD.responsavel_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Busca o ID do time "Liturgia"
  SELECT id INTO v_time_liturgia_id
  FROM public.times_culto
  WHERE nome = 'Liturgia'
  LIMIT 1;

  IF v_time_liturgia_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Verifica se a pessoa tem outros itens de liturgia nesse culto
  SELECT COUNT(*) INTO v_outros_itens
  FROM public.liturgia_culto
  WHERE culto_id = OLD.culto_id
    AND responsavel_id = OLD.responsavel_id
    AND id != OLD.id;

  -- Se não tem outros itens, remove a escala do time Liturgia
  IF v_outros_itens = 0 THEN
    DELETE FROM public.escalas_culto
    WHERE culto_id = OLD.culto_id
      AND pessoa_id = OLD.responsavel_id
      AND time_id = v_time_liturgia_id;
  END IF;

  RETURN OLD;
END;
$function$;

-- 5. Criar trigger para DELETE e UPDATE que remove responsável
DROP TRIGGER IF EXISTS trigger_cleanup_liturgia_escala ON public.liturgia_culto;
CREATE TRIGGER trigger_cleanup_liturgia_escala
  AFTER DELETE ON public.liturgia_culto
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_liturgia_escala();
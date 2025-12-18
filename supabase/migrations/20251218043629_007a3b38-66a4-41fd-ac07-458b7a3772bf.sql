-- Atualizar função para incluir detalhes completos da liturgia nas observações
CREATE OR REPLACE FUNCTION public.sync_liturgia_responsavel_to_escala()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_time_liturgia_id UUID;
  v_escala_existente UUID;
  v_tag TEXT;
  v_detalhes TEXT;
  v_midias_count INTEGER;
  v_midias_nomes TEXT;
BEGIN
  -- Só processa se responsavel_id está preenchido (não é convidado externo)
  IF NEW.responsavel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Monta a tag base com título
  v_tag := 'Liturgia: ' || COALESCE(NULLIF(btrim(NEW.titulo), ''), 'Item');
  
  -- Adiciona descrição se existir
  IF NEW.descricao IS NOT NULL AND btrim(NEW.descricao) != '' THEN
    v_tag := v_tag || ' (' || btrim(NEW.descricao) || ')';
  END IF;
  
  -- Conta e lista mídias vinculadas
  SELECT COUNT(*), string_agg(m.titulo, ', ')
  INTO v_midias_count, v_midias_nomes
  FROM public.liturgia_recursos lr
  JOIN public.midias m ON m.id = lr.midia_id
  WHERE lr.liturgia_item_id = NEW.id;
  
  -- Adiciona info de mídias se existirem
  IF v_midias_count > 0 THEN
    v_tag := v_tag || ' [' || v_midias_count || ' mídia(s): ' || COALESCE(v_midias_nomes, '') || ']';
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
      v_tag,
      'confirmado'
    );
  ELSE
    -- Se já existe, só adiciona a tag se ainda não estiver presente
    UPDATE public.escalas_culto
    SET observacoes = CASE
      WHEN observacoes IS NULL OR btrim(observacoes) = '' THEN v_tag
      WHEN position(v_tag in observacoes) > 0 THEN observacoes
      ELSE observacoes || ' | ' || v_tag
    END
    WHERE id = v_escala_existente;
  END IF;

  RETURN NEW;
END;
$function$;
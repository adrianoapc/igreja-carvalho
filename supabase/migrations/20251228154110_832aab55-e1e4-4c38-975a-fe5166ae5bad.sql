-- =====================================================
-- MIGRATION: Atualização Final de FKs - culto_id → evento_id
-- =====================================================

-- 1. KIDS_CHECKINS: Renomear culto_id para evento_id
ALTER TABLE public.kids_checkins RENAME COLUMN culto_id TO evento_id;

-- Atualizar FK
ALTER TABLE public.kids_checkins DROP CONSTRAINT IF EXISTS kids_checkins_culto_id_fkey;
ALTER TABLE public.kids_checkins DROP CONSTRAINT IF EXISTS kids_checkins_evento_id_fkey;
ALTER TABLE public.kids_checkins 
  ADD CONSTRAINT kids_checkins_evento_id_fkey 
  FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE SET NULL;

-- 2. Recriar VIEW view_kids_checkins_ativos com nova nomenclatura
DROP VIEW IF EXISTS public.view_kids_checkins_ativos;

CREATE VIEW public.view_kids_checkins_ativos AS
SELECT 
  kc.id,
  kc.crianca_id,
  c.nome AS crianca_nome,
  c.avatar_url AS crianca_avatar,
  c.data_nascimento AS crianca_data_nascimento,
  kc.responsavel_id,
  r.nome AS responsavel_nome,
  r.telefone AS responsavel_telefone,
  kc.checkin_at,
  kc.checkin_por,
  cp.nome AS checkin_por_nome,
  kc.evento_id,
  kc.observacoes
FROM public.kids_checkins kc
JOIN public.profiles c ON c.id = kc.crianca_id
JOIN public.profiles r ON r.id = kc.responsavel_id
LEFT JOIN public.profiles cp ON cp.id = kc.checkin_por
WHERE kc.checkout_at IS NULL;

-- 3. Atualizar função registrar_presenca_culto_kids para usar evento_id
CREATE OR REPLACE FUNCTION public.registrar_presenca_culto_kids()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Só processa se o checkout foi agora (não era nulo e agora é preenchido)
  IF OLD.checkout_at IS NULL AND NEW.checkout_at IS NOT NULL THEN
    
    -- Só registra se houver evento vinculado
    IF NEW.evento_id IS NOT NULL THEN
      
      -- 1. Registrar presença da CRIANÇA
      INSERT INTO public.checkins (
        evento_id,
        pessoa_id,
        tipo_registro
      )
      VALUES (
        NEW.evento_id,
        NEW.crianca_id,
        'kids'
      )
      ON CONFLICT (evento_id, pessoa_id) DO NOTHING;
      
      -- 2. Registrar presença do RESPONSÁVEL (pai/mãe que trouxe)
      INSERT INTO public.checkins (
        evento_id,
        pessoa_id,
        tipo_registro
      )
      VALUES (
        NEW.evento_id,
        NEW.responsavel_id,
        'adulto'
      )
      ON CONFLICT (evento_id, pessoa_id) DO NOTHING;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. Verificar e corrigir escalas_culto (já deve ter evento_id, mas garantir FK)
DO $$
BEGIN
  -- Verificar se a coluna ainda se chama culto_id em escalas_culto
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'escalas_culto' 
    AND column_name = 'culto_id'
  ) THEN
    ALTER TABLE public.escalas_culto RENAME COLUMN culto_id TO evento_id;
  END IF;
END $$;

-- Garantir FK correta em escalas_culto
ALTER TABLE public.escalas_culto DROP CONSTRAINT IF EXISTS escalas_culto_culto_id_fkey;
ALTER TABLE public.escalas_culto DROP CONSTRAINT IF EXISTS escalas_culto_evento_id_fkey;
ALTER TABLE public.escalas_culto 
  ADD CONSTRAINT escalas_culto_evento_id_fkey 
  FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;

-- 5. Verificar e corrigir cancoes_culto
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cancoes_culto' 
    AND column_name = 'culto_id'
  ) THEN
    ALTER TABLE public.cancoes_culto RENAME COLUMN culto_id TO evento_id;
  END IF;
END $$;

ALTER TABLE public.cancoes_culto DROP CONSTRAINT IF EXISTS cancoes_culto_culto_id_fkey;
ALTER TABLE public.cancoes_culto DROP CONSTRAINT IF EXISTS cancoes_culto_evento_id_fkey;
ALTER TABLE public.cancoes_culto 
  ADD CONSTRAINT cancoes_culto_evento_id_fkey 
  FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;

-- 6. Verificar e corrigir liturgia_culto
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'liturgia_culto' 
    AND column_name = 'culto_id'
  ) THEN
    ALTER TABLE public.liturgia_culto RENAME COLUMN culto_id TO evento_id;
  END IF;
END $$;

ALTER TABLE public.liturgia_culto DROP CONSTRAINT IF EXISTS liturgia_culto_culto_id_fkey;
ALTER TABLE public.liturgia_culto DROP CONSTRAINT IF EXISTS liturgia_culto_evento_id_fkey;
ALTER TABLE public.liturgia_culto 
  ADD CONSTRAINT liturgia_culto_evento_id_fkey 
  FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;

-- 7. Atualizar função sync_liturgia_responsavel_to_escala para usar evento_id
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

  -- Verifica se já existe escala para essa pessoa nesse evento
  SELECT id INTO v_escala_existente
  FROM public.escalas_culto
  WHERE evento_id = NEW.evento_id
    AND pessoa_id = NEW.responsavel_id
  LIMIT 1;

  -- Se não existe, cria a escala
  IF v_escala_existente IS NULL THEN
    INSERT INTO public.escalas_culto (
      evento_id,
      pessoa_id,
      time_id,
      observacoes,
      status_confirmacao
    )
    VALUES (
      NEW.evento_id,
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

-- 8. Atualizar função cleanup_liturgia_escala para usar evento_id
CREATE OR REPLACE FUNCTION public.cleanup_liturgia_escala()
 RETURNS trigger
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

  -- Verifica se a pessoa tem outros itens de liturgia nesse evento
  SELECT COUNT(*) INTO v_outros_itens
  FROM public.liturgia_culto
  WHERE evento_id = OLD.evento_id
    AND responsavel_id = OLD.responsavel_id
    AND id != OLD.id;

  -- Se não tem outros itens, remove a escala do time Liturgia
  IF v_outros_itens = 0 THEN
    DELETE FROM public.escalas_culto
    WHERE evento_id = OLD.evento_id
      AND pessoa_id = OLD.responsavel_id
      AND time_id = v_time_liturgia_id;
  END IF;

  RETURN OLD;
END;
$function$;

-- 9. Atualizar função check_voluntario_conflito para usar evento_id
CREATE OR REPLACE FUNCTION public.check_voluntario_conflito(p_voluntario_id uuid, p_data_inicio timestamp with time zone, p_duracao_minutos integer DEFAULT 120)
 RETURNS TABLE(conflito_detectado boolean, time_nome text, evento_titulo text, evento_data timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    true::BOOLEAN as conflito_detectado,
    tc.nome as time_nome,
    e.titulo as evento_titulo,
    e.data_evento as evento_data
  FROM public.escalas_culto ec
  JOIN public.eventos e ON ec.evento_id = e.id
  JOIN public.times_culto tc ON ec.time_id = tc.id
  WHERE ec.pessoa_id = p_voluntario_id
  AND ec.status_confirmacao IN ('pendente', 'confirmado')
  AND (
    e.data_evento, 
    e.data_evento + (INTERVAL '1 minute' * COALESCE(e.duracao_minutos, p_duracao_minutos))
  ) OVERLAPS (
    p_data_inicio, 
    p_data_inicio + (INTERVAL '1 minute' * p_duracao_minutos)
  );
END;
$function$;

-- 10. Adicionar comentários de documentação
COMMENT ON COLUMN public.kids_checkins.evento_id IS 'ID do evento onde foi feito o check-in (antigo culto_id)';
COMMENT ON COLUMN public.escalas_culto.evento_id IS 'ID do evento da escala (antigo culto_id)';
COMMENT ON COLUMN public.cancoes_culto.evento_id IS 'ID do evento onde a canção será executada (antigo culto_id)';
COMMENT ON COLUMN public.liturgia_culto.evento_id IS 'ID do evento da liturgia (antigo culto_id)';
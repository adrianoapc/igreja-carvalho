
-- =====================================================
-- MIGRAÇÃO: Generalizar Módulo de Escalas
-- Objetivo: Renomear escalas_culto → escalas para Hub de Voluntariado
-- Data: 2025-12-28
-- =====================================================

-- =====================================================
-- 1. RENOMEAR TABELA PRINCIPAL: escalas_culto → escalas
-- =====================================================

-- 1.1. Renomear a tabela
ALTER TABLE public.escalas_culto RENAME TO escalas;

-- 1.2. Renomear índice único para refletir novo nome e semântica
ALTER INDEX public.escalas_culto_pkey RENAME TO escalas_pkey;
ALTER INDEX public.escalas_culto_culto_id_pessoa_id_posicao_id_key RENAME TO escalas_evento_pessoa_posicao_unique;

-- 1.3. Adicionar comentário documentando a mudança
COMMENT ON TABLE public.escalas IS 'Escalas de voluntários para eventos (generalizado de escalas_culto para suportar Hub de Voluntariado)';
COMMENT ON COLUMN public.escalas.evento_id IS 'Referência ao evento (antigo culto_id - FK para eventos)';

-- =====================================================
-- 2. ATUALIZAR FOREIGN KEY (se necessário)
-- A FK escalas_culto_evento_id_fkey já aponta para eventos
-- Vamos renomeá-la para manter consistência
-- =====================================================

-- 2.1. Verificar e renomear FK se existir com nome antigo
DO $$
BEGIN
  -- Tentar renomear a FK se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'escalas_culto_evento_id_fkey'
    AND table_name = 'escalas'
  ) THEN
    ALTER TABLE public.escalas 
      RENAME CONSTRAINT escalas_culto_evento_id_fkey TO escalas_evento_id_fkey;
  END IF;
  
  -- Renomear outras FKs se existirem
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'escalas_culto_pessoa_id_fkey'
    AND table_name = 'escalas'
  ) THEN
    ALTER TABLE public.escalas 
      RENAME CONSTRAINT escalas_culto_pessoa_id_fkey TO escalas_pessoa_id_fkey;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'escalas_culto_time_id_fkey'
    AND table_name = 'escalas'
  ) THEN
    ALTER TABLE public.escalas 
      RENAME CONSTRAINT escalas_culto_time_id_fkey TO escalas_time_id_fkey;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'escalas_culto_posicao_id_fkey'
    AND table_name = 'escalas'
  ) THEN
    ALTER TABLE public.escalas 
      RENAME CONSTRAINT escalas_culto_posicao_id_fkey TO escalas_posicao_id_fkey;
  END IF;
END $$;

-- =====================================================
-- 3. ATUALIZAR POLICIES (RLS) - Renomear para refletir nova tabela
-- =====================================================

-- 3.1. Dropar policies antigas (usam nome da tabela anterior internamente)
DROP POLICY IF EXISTS "Admins podem gerenciar escalas" ON public.escalas;
DROP POLICY IF EXISTS "Membros podem confirmar suas próprias escalas" ON public.escalas;
DROP POLICY IF EXISTS "Membros podem ver escalas" ON public.escalas;
DROP POLICY IF EXISTS "Voluntario atualiza seu status confirmacao" ON public.escalas;

-- 3.2. Recriar policies com nomes atualizados
CREATE POLICY "Admin gerencia escalas de eventos"
  ON public.escalas
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros visualizam escalas"
  ON public.escalas
  FOR SELECT
  USING (true);

CREATE POLICY "Voluntario confirma propria escala"
  ON public.escalas
  FOR UPDATE
  USING (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (pessoa_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- =====================================================
-- 4. ATUALIZAR FUNÇÕES QUE REFERENCIAM escalas_culto
-- =====================================================

-- 4.1. Atualizar função sync_liturgia_responsavel_to_escala
CREATE OR REPLACE FUNCTION public.sync_liturgia_responsavel_to_escala()
RETURNS TRIGGER AS $$
DECLARE
  v_time_liturgia_id uuid;
  v_escala_existente uuid;
  v_tag_liturgia text;
BEGIN
  -- Se não há responsável interno, não fazer nada
  IF NEW.responsavel_interno_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar time "Liturgia" (ou criar se não existir)
  SELECT id INTO v_time_liturgia_id
  FROM public.times_culto
  WHERE LOWER(nome) = 'liturgia'
  LIMIT 1;

  IF v_time_liturgia_id IS NULL THEN
    RETURN NEW; -- Sem time Liturgia, não sincronizar
  END IF;

  -- Definir tag para identificar origem
  v_tag_liturgia := '[Liturgia:' || NEW.id || ']';

  -- Verificar se já existe escala para esta pessoa/evento/time
  SELECT id INTO v_escala_existente
  FROM public.escalas
  WHERE evento_id = NEW.evento_id
    AND pessoa_id = NEW.responsavel_interno_id
    AND time_id = v_time_liturgia_id
  LIMIT 1;

  IF v_escala_existente IS NOT NULL THEN
    -- Atualizar observações adicionando tag se não existir
    UPDATE public.escalas
    SET observacoes = COALESCE(observacoes, '') || 
                      CASE WHEN observacoes IS NULL OR observacoes NOT LIKE '%' || v_tag_liturgia || '%' 
                           THEN ' ' || v_tag_liturgia 
                           ELSE '' END,
        updated_at = now()
    WHERE id = v_escala_existente;
  ELSE
    -- Inserir nova escala
    INSERT INTO public.escalas (evento_id, pessoa_id, time_id, observacoes, status_confirmacao)
    VALUES (NEW.evento_id, NEW.responsavel_interno_id, v_time_liturgia_id, v_tag_liturgia, 'pendente');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4.2. Atualizar função cleanup_liturgia_escala
CREATE OR REPLACE FUNCTION public.cleanup_liturgia_escala()
RETURNS TRIGGER AS $$
DECLARE
  v_time_liturgia_id uuid;
  v_tag_liturgia text;
  v_outras_liturgias integer;
BEGIN
  -- Se não havia responsável, não fazer nada
  IF OLD.responsavel_interno_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Buscar time "Liturgia"
  SELECT id INTO v_time_liturgia_id
  FROM public.times_culto
  WHERE LOWER(nome) = 'liturgia'
  LIMIT 1;

  IF v_time_liturgia_id IS NULL THEN
    RETURN OLD;
  END IF;

  v_tag_liturgia := '[Liturgia:' || OLD.id || ']';

  -- Verificar se esta pessoa tem outras responsabilidades de liturgia no mesmo evento
  SELECT COUNT(*) INTO v_outras_liturgias
  FROM public.liturgia_culto
  WHERE evento_id = OLD.evento_id
    AND responsavel_interno_id = OLD.responsavel_interno_id
    AND id != OLD.id;

  IF v_outras_liturgias = 0 THEN
    -- Remover a escala do time Liturgia
    DELETE FROM public.escalas
    WHERE evento_id = OLD.evento_id
      AND pessoa_id = OLD.responsavel_interno_id
      AND time_id = v_time_liturgia_id
      AND (observacoes LIKE '%' || v_tag_liturgia || '%' OR observacoes IS NULL);
  ELSE
    -- Apenas remover a tag desta liturgia
    UPDATE public.escalas
    SET observacoes = REPLACE(observacoes, v_tag_liturgia, ''),
        updated_at = now()
    WHERE evento_id = OLD.evento_id
      AND pessoa_id = OLD.responsavel_interno_id
      AND time_id = v_time_liturgia_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4.3. Atualizar função check_voluntario_conflito
CREATE OR REPLACE FUNCTION public.check_voluntario_conflito(
  p_pessoa_id uuid,
  p_evento_id uuid,
  p_escala_id uuid DEFAULT NULL
)
RETURNS TABLE (
  tem_conflito boolean,
  mensagem text
) AS $$
DECLARE
  v_data_evento timestamptz;
  v_conflitos integer;
BEGIN
  -- Buscar data do evento
  SELECT data_evento INTO v_data_evento
  FROM public.eventos
  WHERE id = p_evento_id;

  IF v_data_evento IS NULL THEN
    RETURN QUERY SELECT false, 'Evento não encontrado'::text;
    RETURN;
  END IF;

  -- Verificar conflitos (mesma pessoa escalada para outro evento no mesmo horário)
  SELECT COUNT(*) INTO v_conflitos
  FROM public.escalas e
  JOIN public.eventos ev ON ev.id = e.evento_id
  WHERE e.pessoa_id = p_pessoa_id
    AND e.evento_id != p_evento_id
    AND (p_escala_id IS NULL OR e.id != p_escala_id)
    AND DATE(ev.data_evento) = DATE(v_data_evento)
    AND ABS(EXTRACT(EPOCH FROM (ev.data_evento - v_data_evento))) < 7200; -- 2 horas de margem

  IF v_conflitos > 0 THEN
    RETURN QUERY SELECT true, 'Voluntário já escalado para outro evento próximo'::text;
  ELSE
    RETURN QUERY SELECT false, 'Sem conflitos'::text;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- 5. DOCUMENTAÇÃO FINAL
-- =====================================================

COMMENT ON POLICY "Admin gerencia escalas de eventos" ON public.escalas IS 'Admins têm acesso total às escalas de todos os eventos';
COMMENT ON POLICY "Membros visualizam escalas" ON public.escalas IS 'Todos os membros autenticados podem visualizar escalas';
COMMENT ON POLICY "Voluntario confirma propria escala" ON public.escalas IS 'Voluntários podem confirmar/recusar apenas suas próprias escalas';

-- Verificação final: garantir RLS está ativo
ALTER TABLE public.escalas ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MIGRAÇÃO: Normalização do Módulo de Times (Hub de Voluntariado)
-- Objetivo: Renomear times_culto -> times e atualizar dependências
-- Data: 2024-12-28
-- ============================================================================

-- ============================================================================
-- PARTE 1: RENOMEAÇÃO DA TABELA PRINCIPAL
-- ============================================================================

-- 1.1 Renomear tabela times_culto -> times
ALTER TABLE public.times_culto RENAME TO times;

-- 1.2 Renomear índice primário
ALTER INDEX IF EXISTS times_culto_pkey RENAME TO times_pkey;

-- 1.3 Renomear constraints de Foreign Key internas
ALTER TABLE public.times 
  RENAME CONSTRAINT times_culto_lider_id_fkey TO times_lider_id_fkey;

ALTER TABLE public.times 
  RENAME CONSTRAINT times_culto_sublider_id_fkey TO times_sublider_id_fkey;

-- Adicionar comentário de documentação
COMMENT ON TABLE public.times IS 'Cadastro de times/equipes de voluntários para qualquer tipo de evento';

-- ============================================================================
-- PARTE 2: ATUALIZAÇÃO DAS TABELAS DEPENDENTES
-- ============================================================================

-- 2.1 Atualizar FK em membros_time
ALTER TABLE public.membros_time
  DROP CONSTRAINT IF EXISTS membros_time_time_id_fkey;

ALTER TABLE public.membros_time
  ADD CONSTRAINT membros_time_time_id_fkey 
  FOREIGN KEY (time_id) REFERENCES public.times(id) ON DELETE CASCADE;

-- 2.2 Atualizar FK em posicoes_time
ALTER TABLE public.posicoes_time
  DROP CONSTRAINT IF EXISTS posicoes_time_time_id_fkey;

ALTER TABLE public.posicoes_time
  ADD CONSTRAINT posicoes_time_time_id_fkey 
  FOREIGN KEY (time_id) REFERENCES public.times(id) ON DELETE CASCADE;

-- 2.3 Atualizar FK em escalas
ALTER TABLE public.escalas
  DROP CONSTRAINT IF EXISTS escalas_time_id_fkey;

ALTER TABLE public.escalas
  ADD CONSTRAINT escalas_time_id_fkey 
  FOREIGN KEY (time_id) REFERENCES public.times(id) ON DELETE SET NULL;

-- 2.4 Atualizar FK em escalas_template
ALTER TABLE public.escalas_template
  DROP CONSTRAINT IF EXISTS escalas_template_time_id_fkey;

ALTER TABLE public.escalas_template
  ADD CONSTRAINT escalas_template_time_id_fkey 
  FOREIGN KEY (time_id) REFERENCES public.times(id) ON DELETE CASCADE;

-- ============================================================================
-- PARTE 3: ATUALIZAÇÃO DAS POLICIES (RLS)
-- ============================================================================

-- 3.1 Remover policies antigas da tabela times (antiga times_culto)
DROP POLICY IF EXISTS "Admins podem gerenciar times" ON public.times;
DROP POLICY IF EXISTS "Membros podem ver times ativos" ON public.times;

-- 3.2 Criar novas policies com nomes padronizados
CREATE POLICY "Admin gerencia times" ON public.times
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros visualizam times ativos" ON public.times
  FOR SELECT
  USING ((ativo = true) OR has_role(auth.uid(), 'admin'::app_role));

-- Adicionar comentários nas policies
COMMENT ON POLICY "Admin gerencia times" ON public.times IS 'Admins podem gerenciar todos os times';
COMMENT ON POLICY "Membros visualizam times ativos" ON public.times IS 'Usuários podem ver times ativos';

-- ============================================================================
-- PARTE 4: ATUALIZAÇÃO DAS FUNÇÕES QUE REFERENCIAM times_culto
-- ============================================================================

-- 4.1 Recriar função sync_membro_intercessor
CREATE OR REPLACE FUNCTION public.sync_membro_intercessor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_time_nome TEXT;
  v_user_id UUID;
  v_user_nome TEXT;
  v_user_email TEXT;
  v_user_telefone TEXT;
BEGIN
  -- Descobre o nome do time onde a pessoa entrou
  SELECT nome INTO v_time_nome FROM public.times WHERE id = NEW.time_id;

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
$function$;

COMMENT ON FUNCTION public.sync_membro_intercessor() IS 'Sincroniza membro de time de intercessão com tabela de intercessores';

-- 4.2 Recriar função sync_remove_intercessor
CREATE OR REPLACE FUNCTION public.sync_remove_intercessor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_time_nome TEXT;
  v_user_id UUID;
BEGIN
  SELECT nome INTO v_time_nome FROM public.times WHERE id = OLD.time_id;

  IF v_time_nome ILIKE '%Intercessão%' OR v_time_nome ILIKE '%Oração%' OR v_time_nome ILIKE '%Clamor%' THEN
    SELECT user_id INTO v_user_id FROM public.profiles WHERE id = OLD.pessoa_id;
    
    IF v_user_id IS NOT NULL THEN
      UPDATE public.intercessores SET ativo = false WHERE user_id = v_user_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$function$;

COMMENT ON FUNCTION public.sync_remove_intercessor() IS 'Desativa intercessor quando removido do time de intercessão';

-- 4.3 Recriar função sync_profile_intercessor_on_user_link
CREATE OR REPLACE FUNCTION public.sync_profile_intercessor_on_user_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (OLD.user_id IS NULL AND NEW.user_id IS NOT NULL) THEN
    IF EXISTS (
      SELECT 1
      FROM public.membros_time mt
      JOIN public.times tc ON tc.id = mt.time_id
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
$function$;

COMMENT ON FUNCTION public.sync_profile_intercessor_on_user_link() IS 'Sincroniza intercessor quando perfil é vinculado a usuário';

-- 4.4 Recriar função sync_liturgia_responsavel_to_escala (referencia times)
CREATE OR REPLACE FUNCTION public.sync_liturgia_responsavel_to_escala()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_time_liturgia_id uuid;
  v_escala_existente uuid;
  v_tag_liturgia text;
BEGIN
  -- Se não há responsável interno, não fazer nada
  IF NEW.responsavel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar time "Liturgia" (ou criar se não existir)
  SELECT id INTO v_time_liturgia_id
  FROM public.times
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
    AND pessoa_id = NEW.responsavel_id
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
    VALUES (NEW.evento_id, NEW.responsavel_id, v_time_liturgia_id, v_tag_liturgia, 'pendente');
  END IF;

  RETURN NEW;
END;
$function$;

-- 4.5 Recriar função cleanup_liturgia_escala (referencia times)
CREATE OR REPLACE FUNCTION public.cleanup_liturgia_escala()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_time_liturgia_id uuid;
  v_tag_liturgia text;
  v_outras_liturgias integer;
BEGIN
  -- Se não havia responsável, não fazer nada
  IF OLD.responsavel_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Buscar time "Liturgia"
  SELECT id INTO v_time_liturgia_id
  FROM public.times
  WHERE LOWER(nome) = 'liturgia'
  LIMIT 1;

  IF v_time_liturgia_id IS NULL THEN
    RETURN OLD;
  END IF;

  v_tag_liturgia := '[Liturgia:' || OLD.id || ']';

  -- Verificar se esta pessoa tem outras responsabilidades de liturgia no mesmo evento
  SELECT COUNT(*) INTO v_outras_liturgias
  FROM public.liturgias
  WHERE evento_id = OLD.evento_id
    AND responsavel_id = OLD.responsavel_id
    AND id != OLD.id;

  IF v_outras_liturgias = 0 THEN
    -- Remover a escala do time Liturgia
    DELETE FROM public.escalas
    WHERE evento_id = OLD.evento_id
      AND pessoa_id = OLD.responsavel_id
      AND time_id = v_time_liturgia_id
      AND (observacoes LIKE '%' || v_tag_liturgia || '%' OR observacoes IS NULL);
  ELSE
    -- Apenas remover a tag desta liturgia
    UPDATE public.escalas
    SET observacoes = REPLACE(observacoes, v_tag_liturgia, ''),
        updated_at = now()
    WHERE evento_id = OLD.evento_id
      AND pessoa_id = OLD.responsavel_id
      AND time_id = v_time_liturgia_id;
  END IF;

  RETURN OLD;
END;
$function$;

-- ============================================================================
-- PARTE 5: RENOMEAR TABELA DE CATEGORIAS (Consistência)
-- ============================================================================

-- 5.1 Renomear categorias_times -> categorias_time (singular consistente)
-- Nota: Mantendo no plural pois categorias é uma tabela de lookup
-- Apenas adicionar comentário
COMMENT ON TABLE public.categorias_times IS 'Categorias para classificação de times (Louvor, Recepção, etc)';

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- ============================================================================
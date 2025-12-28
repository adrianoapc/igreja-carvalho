-- ============================================================================
-- MIGRAÇÃO: Normalização do Módulo de Liturgias
-- Objetivo: Renomear liturgia_culto -> liturgias e atualizar dependências
-- Data: 2024-12-28
-- ============================================================================

-- ============================================================================
-- PARTE 1: RENOMEAÇÃO DA TABELA PRINCIPAL
-- ============================================================================

-- 1.1 Renomear tabela liturgia_culto -> liturgias
ALTER TABLE public.liturgia_culto RENAME TO liturgias;

-- 1.2 Renomear índice primário
ALTER INDEX IF EXISTS liturgia_culto_pkey RENAME TO liturgias_pkey;

-- 1.3 Renomear constraints de Foreign Key
ALTER TABLE public.liturgias 
  RENAME CONSTRAINT liturgia_culto_evento_id_fkey TO liturgias_evento_id_fkey;

ALTER TABLE public.liturgias 
  RENAME CONSTRAINT liturgia_culto_responsavel_id_fkey TO liturgias_responsavel_id_fkey;

-- 1.4 Criar índice na FK evento_id (se não existir)
CREATE INDEX IF NOT EXISTS idx_liturgias_evento_id ON public.liturgias(evento_id);

-- Adicionar comentário de documentação
COMMENT ON TABLE public.liturgias IS 'Itens de liturgia vinculados a eventos (cultos, celebrações, etc)';
COMMENT ON COLUMN public.liturgias.evento_id IS 'FK para tabela eventos (antiga cultos)';

-- ============================================================================
-- PARTE 2: ATUALIZAÇÃO DA TABELA FILHA (liturgia_recursos)
-- ============================================================================

-- 2.1 Atualizar FK que aponta para liturgias (antes liturgia_culto)
ALTER TABLE public.liturgia_recursos
  DROP CONSTRAINT IF EXISTS liturgia_recursos_liturgia_item_id_fkey;

ALTER TABLE public.liturgia_recursos
  ADD CONSTRAINT liturgia_recursos_liturgia_item_id_fkey 
  FOREIGN KEY (liturgia_item_id) REFERENCES public.liturgias(id) ON DELETE CASCADE;

-- ============================================================================
-- PARTE 3: ATUALIZAÇÃO DAS POLICIES (RLS)
-- ============================================================================

-- 3.1 Remover policies antigas da tabela liturgias (antiga liturgia_culto)
DROP POLICY IF EXISTS "Admins podem gerenciar liturgia" ON public.liturgias;
DROP POLICY IF EXISTS "Membros podem ver liturgia" ON public.liturgias;

-- 3.2 Criar novas policies com nomes atualizados
CREATE POLICY "Admin gerencia liturgias" ON public.liturgias
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros visualizam liturgias" ON public.liturgias
  FOR SELECT
  USING (true);

-- Adicionar comentários nas policies
COMMENT ON POLICY "Admin gerencia liturgias" ON public.liturgias IS 'Admins podem gerenciar todos os itens de liturgia';
COMMENT ON POLICY "Membros visualizam liturgias" ON public.liturgias IS 'Qualquer usuário autenticado pode visualizar liturgias';

-- ============================================================================
-- PARTE 4: ATUALIZAÇÃO DAS FUNÇÕES QUE REFERENCIAM liturgia_culto
-- ============================================================================

-- 4.1 Recriar função sync_liturgia_responsavel_to_escala
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

COMMENT ON FUNCTION public.sync_liturgia_responsavel_to_escala() IS 'Sincroniza responsável de liturgia com escalas do time Liturgia';

-- 4.2 Recriar função cleanup_liturgia_escala
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
  FROM public.times_culto
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

COMMENT ON FUNCTION public.cleanup_liturgia_escala() IS 'Remove escala de liturgia quando item é deletado';

-- ============================================================================
-- PARTE 5: RECRIAR TRIGGERS NA NOVA TABELA
-- ============================================================================

-- 5.1 Remover triggers antigos (se existirem com nomes antigos)
DROP TRIGGER IF EXISTS sync_liturgia_to_escala ON public.liturgias;
DROP TRIGGER IF EXISTS cleanup_liturgia_on_delete ON public.liturgias;

-- 5.2 Criar triggers na tabela renomeada
CREATE TRIGGER sync_liturgia_to_escala
  AFTER INSERT OR UPDATE OF responsavel_id ON public.liturgias
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_liturgia_responsavel_to_escala();

CREATE TRIGGER cleanup_liturgia_on_delete
  AFTER DELETE ON public.liturgias
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_liturgia_escala();

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- ============================================================================
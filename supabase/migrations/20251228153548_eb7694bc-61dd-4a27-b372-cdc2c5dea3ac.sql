-- =====================================================
-- MIGRAÇÃO: Hub de Eventos - Transformar Cultos em Eventos
-- Etapa 1: Estrutura Base
-- =====================================================

-- 1. CRIAR ENUM evento_tipo
DO $$ BEGIN
  CREATE TYPE evento_tipo AS ENUM ('CULTO', 'RELOGIO', 'TAREFA', 'EVENTO', 'OUTRO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. CRIAR TABELA evento_subtipos
CREATE TABLE IF NOT EXISTS public.evento_subtipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo_pai evento_tipo NOT NULL,
  cor TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para evento_subtipos
ALTER TABLE public.evento_subtipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura publica subtipos" ON public.evento_subtipos
  FOR SELECT USING (true);

CREATE POLICY "Admin gerencia subtipos" ON public.evento_subtipos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. RENOMEAR TABELA cultos -> eventos
ALTER TABLE IF EXISTS public.cultos RENAME TO eventos;

-- 4. RENOMEAR COLUNA data_culto -> data_evento
ALTER TABLE public.eventos RENAME COLUMN data_culto TO data_evento;

-- 5. ADICIONAR NOVAS COLUNAS
ALTER TABLE public.eventos 
  ADD COLUMN IF NOT EXISTS tipo evento_tipo NOT NULL DEFAULT 'CULTO',
  ADD COLUMN IF NOT EXISTS subtipo_id UUID REFERENCES public.evento_subtipos(id);

-- 6. ATUALIZAR FOREIGN KEYS EM TABELAS DEPENDENTES

-- 6.1 cancoes_culto -> renomear coluna
ALTER TABLE public.cancoes_culto RENAME COLUMN culto_id TO evento_id;
ALTER TABLE public.cancoes_culto DROP CONSTRAINT IF EXISTS cancoes_culto_culto_id_fkey;
ALTER TABLE public.cancoes_culto 
  ADD CONSTRAINT cancoes_culto_evento_id_fkey 
  FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;

-- 6.2 liturgia_culto -> renomear coluna
ALTER TABLE public.liturgia_culto RENAME COLUMN culto_id TO evento_id;
ALTER TABLE public.liturgia_culto DROP CONSTRAINT IF EXISTS liturgia_culto_culto_id_fkey;
ALTER TABLE public.liturgia_culto 
  ADD CONSTRAINT liturgia_culto_evento_id_fkey 
  FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;

-- 6.3 comunicados (se tiver culto_id)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'comunicados' AND column_name = 'culto_id') THEN
    ALTER TABLE public.comunicados RENAME COLUMN culto_id TO evento_id;
    ALTER TABLE public.comunicados DROP CONSTRAINT IF EXISTS comunicados_culto_id_fkey;
    ALTER TABLE public.comunicados 
      ADD CONSTRAINT comunicados_evento_id_fkey 
      FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6.4 aulas (se tiver culto_id)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'aulas' AND column_name = 'culto_id') THEN
    ALTER TABLE public.aulas RENAME COLUMN culto_id TO evento_id;
    ALTER TABLE public.aulas DROP CONSTRAINT IF EXISTS aulas_culto_id_fkey;
    ALTER TABLE public.aulas 
      ADD CONSTRAINT aulas_evento_id_fkey 
      FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6.5 kids_checkins (manter culto_id por enquanto, apenas atualizar FK)
ALTER TABLE public.kids_checkins DROP CONSTRAINT IF EXISTS kids_checkins_culto_id_fkey;
ALTER TABLE public.kids_checkins 
  ADD CONSTRAINT kids_checkins_evento_id_fkey 
  FOREIGN KEY (culto_id) REFERENCES public.eventos(id) ON DELETE SET NULL;

-- 6.6 presencas_culto (será migrada depois, apenas atualizar FK)
ALTER TABLE public.presencas_culto DROP CONSTRAINT IF EXISTS presencas_culto_culto_id_fkey;
ALTER TABLE public.presencas_culto 
  ADD CONSTRAINT presencas_culto_evento_id_fkey 
  FOREIGN KEY (culto_id) REFERENCES public.eventos(id) ON DELETE CASCADE;

-- 6.7 escalas_culto (se ainda existir com nome antigo)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'escalas_culto') THEN
    ALTER TABLE public.escalas_culto RENAME COLUMN culto_id TO evento_id;
    ALTER TABLE public.escalas_culto DROP CONSTRAINT IF EXISTS escalas_culto_culto_id_fkey;
    ALTER TABLE public.escalas_culto 
      ADD CONSTRAINT escalas_culto_evento_id_fkey 
      FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6.8 escalas (se já foi renomeada)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'escalas') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'escalas' AND column_name = 'culto_id') THEN
      ALTER TABLE public.escalas RENAME COLUMN culto_id TO evento_id;
    END IF;
    ALTER TABLE public.escalas DROP CONSTRAINT IF EXISTS escalas_culto_id_fkey;
    ALTER TABLE public.escalas DROP CONSTRAINT IF EXISTS escalas_evento_id_fkey;
    ALTER TABLE public.escalas 
      ADD CONSTRAINT escalas_evento_id_fkey 
      FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 7. ATUALIZAR RLS DA TABELA eventos
DROP POLICY IF EXISTS "Admins podem gerenciar cultos" ON public.eventos;
DROP POLICY IF EXISTS "Membros podem ver cultos" ON public.eventos;

CREATE POLICY "Admin gerencia eventos" ON public.eventos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros visualizam eventos" ON public.eventos
  FOR SELECT USING (true);

-- 8. SEED DE SUBTIPOS PADRÃO
INSERT INTO public.evento_subtipos (nome, tipo_pai, cor) VALUES
  ('Culto de Celebração', 'CULTO', '#3B82F6'),
  ('Culto de Ensino', 'CULTO', '#8B5CF6'),
  ('Relógio de Oração', 'RELOGIO', '#F59E0B'),
  ('Manutenção/Limpeza', 'TAREFA', '#10B981'),
  ('Reunião de Líderes', 'EVENTO', '#EC4899'),
  ('Evento Especial', 'EVENTO', '#6366F1')
ON CONFLICT DO NOTHING;

-- 9. ATUALIZAR REGISTROS EXISTENTES
UPDATE public.eventos SET tipo = 'CULTO' WHERE tipo IS NULL;

-- Vincular ao subtipo padrão
UPDATE public.eventos 
SET subtipo_id = (SELECT id FROM public.evento_subtipos WHERE nome = 'Culto de Celebração' LIMIT 1)
WHERE subtipo_id IS NULL;

-- 10. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON TABLE public.eventos IS 'Hub de Eventos - antiga tabela cultos, agora generalizada';
COMMENT ON COLUMN public.eventos.tipo IS 'Tipo principal do evento (ENUM)';
COMMENT ON COLUMN public.eventos.subtipo_id IS 'FK para detalhamento do tipo';
COMMENT ON COLUMN public.eventos.data_evento IS 'Data/hora do evento (antiga data_culto)';
COMMENT ON TABLE public.evento_subtipos IS 'Subtipos de eventos para categorização granular';
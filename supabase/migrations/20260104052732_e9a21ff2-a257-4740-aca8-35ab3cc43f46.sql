
-- =====================================================
-- CONTINUAÇÃO: ADICIONAR igreja_id NAS TABELAS
-- =====================================================

-- FASE 1: MÓDULO FINANCEIRO (tabelas que faltaram)
-- solicitacoes_reembolso
ALTER TABLE public.solicitacoes_reembolso ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.solicitacoes_reembolso SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'solicitacoes_reembolso_igreja_id_fkey') THEN
    ALTER TABLE public.solicitacoes_reembolso ADD CONSTRAINT solicitacoes_reembolso_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_solicitacoes_reembolso_igreja_id ON public.solicitacoes_reembolso(igreja_id);

-- =====================================================
-- FASE 2: MÓDULO PESSOAS/FAMÍLIAS
-- =====================================================

-- familias
ALTER TABLE public.familias ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.familias SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'familias_igreja_id_fkey') THEN
    ALTER TABLE public.familias ADD CONSTRAINT familias_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_familias_igreja_id ON public.familias(igreja_id);

-- visitante_contatos
ALTER TABLE public.visitante_contatos ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.visitante_contatos SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visitante_contatos_igreja_id_fkey') THEN
    ALTER TABLE public.visitante_contatos ADD CONSTRAINT visitante_contatos_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_visitante_contatos_igreja_id ON public.visitante_contatos(igreja_id);

-- visitantes_leads
ALTER TABLE public.visitantes_leads ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.visitantes_leads SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visitantes_leads_igreja_id_fkey') THEN
    ALTER TABLE public.visitantes_leads ADD CONSTRAINT visitantes_leads_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_visitantes_leads_igreja_id ON public.visitantes_leads(igreja_id);

-- =====================================================
-- FASE 3: MÓDULO TIMES/ESCALAS
-- =====================================================

-- times
ALTER TABLE public.times ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.times SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'times_igreja_id_fkey') THEN
    ALTER TABLE public.times ADD CONSTRAINT times_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_times_igreja_id ON public.times(igreja_id);

-- posicoes_time
ALTER TABLE public.posicoes_time ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.posicoes_time SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posicoes_time_igreja_id_fkey') THEN
    ALTER TABLE public.posicoes_time ADD CONSTRAINT posicoes_time_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_posicoes_time_igreja_id ON public.posicoes_time(igreja_id);

-- membros_time
ALTER TABLE public.membros_time ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.membros_time SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membros_time_igreja_id_fkey') THEN
    ALTER TABLE public.membros_time ADD CONSTRAINT membros_time_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_membros_time_igreja_id ON public.membros_time(igreja_id);

-- escalas
ALTER TABLE public.escalas ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.escalas SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'escalas_igreja_id_fkey') THEN
    ALTER TABLE public.escalas ADD CONSTRAINT escalas_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_escalas_igreja_id ON public.escalas(igreja_id);

-- categorias_times
ALTER TABLE public.categorias_times ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.categorias_times SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categorias_times_igreja_id_fkey') THEN
    ALTER TABLE public.categorias_times ADD CONSTRAINT categorias_times_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_categorias_times_igreja_id ON public.categorias_times(igreja_id);

-- escalas_template
ALTER TABLE public.escalas_template ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.escalas_template SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'escalas_template_igreja_id_fkey') THEN
    ALTER TABLE public.escalas_template ADD CONSTRAINT escalas_template_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_escalas_template_igreja_id ON public.escalas_template(igreja_id);

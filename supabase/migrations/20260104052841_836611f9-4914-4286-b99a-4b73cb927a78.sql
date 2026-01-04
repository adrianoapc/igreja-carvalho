
-- =====================================================
-- FASE 4: MÓDULO EVENTOS/CULTOS
-- =====================================================

-- eventos_convites
ALTER TABLE public.eventos_convites ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.eventos_convites SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eventos_convites_igreja_id_fkey') THEN
    ALTER TABLE public.eventos_convites ADD CONSTRAINT eventos_convites_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_eventos_convites_igreja_id ON public.eventos_convites(igreja_id);

-- inscricoes_eventos
ALTER TABLE public.inscricoes_eventos ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.inscricoes_eventos SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inscricoes_eventos_igreja_id_fkey') THEN
    ALTER TABLE public.inscricoes_eventos ADD CONSTRAINT inscricoes_eventos_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_inscricoes_eventos_igreja_id ON public.inscricoes_eventos(igreja_id);

-- liturgias
ALTER TABLE public.liturgias ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.liturgias SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'liturgias_igreja_id_fkey') THEN
    ALTER TABLE public.liturgias ADD CONSTRAINT liturgias_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_liturgias_igreja_id ON public.liturgias(igreja_id);

-- cancoes_culto
ALTER TABLE public.cancoes_culto ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.cancoes_culto SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cancoes_culto_igreja_id_fkey') THEN
    ALTER TABLE public.cancoes_culto ADD CONSTRAINT cancoes_culto_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_cancoes_culto_igreja_id ON public.cancoes_culto(igreja_id);

-- midias
ALTER TABLE public.midias ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.midias SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'midias_igreja_id_fkey') THEN
    ALTER TABLE public.midias ADD CONSTRAINT midias_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_midias_igreja_id ON public.midias(igreja_id);

-- comunicados
ALTER TABLE public.comunicados ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.comunicados SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comunicados_igreja_id_fkey') THEN
    ALTER TABLE public.comunicados ADD CONSTRAINT comunicados_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_comunicados_igreja_id ON public.comunicados(igreja_id);

-- banners
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.banners SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banners_igreja_id_fkey') THEN
    ALTER TABLE public.banners ADD CONSTRAINT banners_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_banners_igreja_id ON public.banners(igreja_id);

-- templates_culto
ALTER TABLE public.templates_culto ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.templates_culto SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'templates_culto_igreja_id_fkey') THEN
    ALTER TABLE public.templates_culto ADD CONSTRAINT templates_culto_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_templates_culto_igreja_id ON public.templates_culto(igreja_id);

-- checkins
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.checkins SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checkins_igreja_id_fkey') THEN
    ALTER TABLE public.checkins ADD CONSTRAINT checkins_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_checkins_igreja_id ON public.checkins(igreja_id);

-- =====================================================
-- FASE 5: MÓDULO IGREJA/MEMBROS
-- =====================================================

-- funcoes_igreja
ALTER TABLE public.funcoes_igreja ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.funcoes_igreja SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'funcoes_igreja_igreja_id_fkey') THEN
    ALTER TABLE public.funcoes_igreja ADD CONSTRAINT funcoes_igreja_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_funcoes_igreja_igreja_id ON public.funcoes_igreja(igreja_id);

-- membro_funcoes
ALTER TABLE public.membro_funcoes ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.membro_funcoes SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membro_funcoes_igreja_id_fkey') THEN
    ALTER TABLE public.membro_funcoes ADD CONSTRAINT membro_funcoes_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_membro_funcoes_igreja_id ON public.membro_funcoes(igreja_id);

-- pedidos_oracao
ALTER TABLE public.pedidos_oracao ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.pedidos_oracao SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_oracao_igreja_id_fkey') THEN
    ALTER TABLE public.pedidos_oracao ADD CONSTRAINT pedidos_oracao_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_pedidos_oracao_igreja_id ON public.pedidos_oracao(igreja_id);

-- testemunhos
ALTER TABLE public.testemunhos ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.testemunhos SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'testemunhos_igreja_id_fkey') THEN
    ALTER TABLE public.testemunhos ADD CONSTRAINT testemunhos_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_testemunhos_igreja_id ON public.testemunhos(igreja_id);

-- intercessores
ALTER TABLE public.intercessores ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.intercessores SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'intercessores_igreja_id_fkey') THEN
    ALTER TABLE public.intercessores ADD CONSTRAINT intercessores_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_intercessores_igreja_id ON public.intercessores(igreja_id);

-- sentimentos_membros
ALTER TABLE public.sentimentos_membros ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.sentimentos_membros SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sentimentos_membros_igreja_id_fkey') THEN
    ALTER TABLE public.sentimentos_membros ADD CONSTRAINT sentimentos_membros_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_sentimentos_membros_igreja_id ON public.sentimentos_membros(igreja_id);

-- =====================================================
-- FASE 6: MÓDULOS ADICIONAIS
-- =====================================================

-- jornadas
ALTER TABLE public.jornadas ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.jornadas SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jornadas_igreja_id_fkey') THEN
    ALTER TABLE public.jornadas ADD CONSTRAINT jornadas_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_jornadas_igreja_id ON public.jornadas(igreja_id);

-- salas
ALTER TABLE public.salas ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.salas SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'salas_igreja_id_fkey') THEN
    ALTER TABLE public.salas ADD CONSTRAINT salas_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_salas_igreja_id ON public.salas(igreja_id);

-- aulas
ALTER TABLE public.aulas ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.aulas SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aulas_igreja_id_fkey') THEN
    ALTER TABLE public.aulas ADD CONSTRAINT aulas_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_aulas_igreja_id ON public.aulas(igreja_id);

-- kids_checkins
ALTER TABLE public.kids_checkins ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.kids_checkins SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kids_checkins_igreja_id_fkey') THEN
    ALTER TABLE public.kids_checkins ADD CONSTRAINT kids_checkins_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_kids_checkins_igreja_id ON public.kids_checkins(igreja_id);

-- candidatos_voluntario
ALTER TABLE public.candidatos_voluntario ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.candidatos_voluntario SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'candidatos_voluntario_igreja_id_fkey') THEN
    ALTER TABLE public.candidatos_voluntario ADD CONSTRAINT candidatos_voluntario_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_candidatos_voluntario_igreja_id ON public.candidatos_voluntario(igreja_id);

-- projetos
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.projetos SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projetos_igreja_id_fkey') THEN
    ALTER TABLE public.projetos ADD CONSTRAINT projetos_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_projetos_igreja_id ON public.projetos(igreja_id);

-- tarefas
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.tarefas SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tarefas_igreja_id_fkey') THEN
    ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_tarefas_igreja_id ON public.tarefas(igreja_id);

-- atendimentos_pastorais
ALTER TABLE public.atendimentos_pastorais ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.atendimentos_pastorais SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atendimentos_pastorais_igreja_id_fkey') THEN
    ALTER TABLE public.atendimentos_pastorais ADD CONSTRAINT atendimentos_pastorais_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_atendimentos_pastorais_igreja_id ON public.atendimentos_pastorais(igreja_id);

-- notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.notifications SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_igreja_id_fkey') THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_notifications_igreja_id ON public.notifications(igreja_id);

-- atendimentos_bot
ALTER TABLE public.atendimentos_bot ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.atendimentos_bot SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'atendimentos_bot_igreja_id_fkey') THEN
    ALTER TABLE public.atendimentos_bot ADD CONSTRAINT atendimentos_bot_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_atendimentos_bot_igreja_id ON public.atendimentos_bot(igreja_id);

-- agenda_pastoral
ALTER TABLE public.agenda_pastoral ADD COLUMN IF NOT EXISTS igreja_id UUID;
UPDATE public.agenda_pastoral SET igreja_id = (SELECT id FROM public.igrejas ORDER BY created_at LIMIT 1) WHERE igreja_id IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agenda_pastoral_igreja_id_fkey') THEN
    ALTER TABLE public.agenda_pastoral ADD CONSTRAINT agenda_pastoral_igreja_id_fkey FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_agenda_pastoral_igreja_id ON public.agenda_pastoral(igreja_id);

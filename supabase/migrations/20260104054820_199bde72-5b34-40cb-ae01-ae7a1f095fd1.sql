-- Migration: Adicionar FKs para igreja_id (Parte 2)

-- centros_custo
ALTER TABLE public.centros_custo
  DROP CONSTRAINT IF EXISTS centros_custo_igreja_id_fkey;
ALTER TABLE public.centros_custo
  ADD CONSTRAINT centros_custo_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- checkins
ALTER TABLE public.checkins
  DROP CONSTRAINT IF EXISTS checkins_igreja_id_fkey;
ALTER TABLE public.checkins
  ADD CONSTRAINT checkins_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- comunicados
ALTER TABLE public.comunicados
  DROP CONSTRAINT IF EXISTS comunicados_igreja_id_fkey;
ALTER TABLE public.comunicados
  ADD CONSTRAINT comunicados_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- configuracoes_igreja
ALTER TABLE public.configuracoes_igreja
  DROP CONSTRAINT IF EXISTS configuracoes_igreja_igreja_id_fkey;
ALTER TABLE public.configuracoes_igreja
  ADD CONSTRAINT configuracoes_igreja_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- contas
ALTER TABLE public.contas
  DROP CONSTRAINT IF EXISTS contas_igreja_id_fkey;
ALTER TABLE public.contas
  ADD CONSTRAINT contas_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- escalas
ALTER TABLE public.escalas
  DROP CONSTRAINT IF EXISTS escalas_igreja_id_fkey;
ALTER TABLE public.escalas
  ADD CONSTRAINT escalas_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- escalas_template
ALTER TABLE public.escalas_template
  DROP CONSTRAINT IF EXISTS escalas_template_igreja_id_fkey;
ALTER TABLE public.escalas_template
  ADD CONSTRAINT escalas_template_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- etapas_jornada
ALTER TABLE public.etapas_jornada
  DROP CONSTRAINT IF EXISTS etapas_jornada_igreja_id_fkey;
ALTER TABLE public.etapas_jornada
  ADD CONSTRAINT etapas_jornada_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- evento_subtipos
ALTER TABLE public.evento_subtipos
  DROP CONSTRAINT IF EXISTS evento_subtipos_igreja_id_fkey;
ALTER TABLE public.evento_subtipos
  ADD CONSTRAINT evento_subtipos_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- eventos
ALTER TABLE public.eventos
  DROP CONSTRAINT IF EXISTS eventos_igreja_id_fkey;
ALTER TABLE public.eventos
  ADD CONSTRAINT eventos_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
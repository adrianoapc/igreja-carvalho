-- Migration: Adicionar FKs para igreja_id (Parte 5)

-- projetos
ALTER TABLE public.projetos
  DROP CONSTRAINT IF EXISTS projetos_igreja_id_fkey;
ALTER TABLE public.projetos
  ADD CONSTRAINT projetos_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- salas
ALTER TABLE public.salas
  DROP CONSTRAINT IF EXISTS salas_igreja_id_fkey;
ALTER TABLE public.salas
  ADD CONSTRAINT salas_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- sentimentos_membros
ALTER TABLE public.sentimentos_membros
  DROP CONSTRAINT IF EXISTS sentimentos_membros_igreja_id_fkey;
ALTER TABLE public.sentimentos_membros
  ADD CONSTRAINT sentimentos_membros_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- solicitacoes_reembolso
ALTER TABLE public.solicitacoes_reembolso
  DROP CONSTRAINT IF EXISTS solicitacoes_reembolso_igreja_id_fkey;
ALTER TABLE public.solicitacoes_reembolso
  ADD CONSTRAINT solicitacoes_reembolso_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- subcategorias_financeiras
ALTER TABLE public.subcategorias_financeiras
  DROP CONSTRAINT IF EXISTS subcategorias_financeiras_igreja_id_fkey;
ALTER TABLE public.subcategorias_financeiras
  ADD CONSTRAINT subcategorias_financeiras_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- tags_midias
ALTER TABLE public.tags_midias
  DROP CONSTRAINT IF EXISTS tags_midias_igreja_id_fkey;
ALTER TABLE public.tags_midias
  ADD CONSTRAINT tags_midias_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- tarefas
ALTER TABLE public.tarefas
  DROP CONSTRAINT IF EXISTS tarefas_igreja_id_fkey;
ALTER TABLE public.tarefas
  ADD CONSTRAINT tarefas_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- templates_culto
ALTER TABLE public.templates_culto
  DROP CONSTRAINT IF EXISTS templates_culto_igreja_id_fkey;
ALTER TABLE public.templates_culto
  ADD CONSTRAINT templates_culto_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- testemunhos
ALTER TABLE public.testemunhos
  DROP CONSTRAINT IF EXISTS testemunhos_igreja_id_fkey;
ALTER TABLE public.testemunhos
  ADD CONSTRAINT testemunhos_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- times
ALTER TABLE public.times
  DROP CONSTRAINT IF EXISTS times_igreja_id_fkey;
ALTER TABLE public.times
  ADD CONSTRAINT times_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- transacoes_financeiras
ALTER TABLE public.transacoes_financeiras
  DROP CONSTRAINT IF EXISTS transacoes_financeiras_igreja_id_fkey;
ALTER TABLE public.transacoes_financeiras
  ADD CONSTRAINT transacoes_financeiras_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- visitantes_leads
ALTER TABLE public.visitantes_leads
  DROP CONSTRAINT IF EXISTS visitantes_leads_igreja_id_fkey;
ALTER TABLE public.visitantes_leads
  ADD CONSTRAINT visitantes_leads_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- agenda_pastoral
ALTER TABLE public.agenda_pastoral
  DROP CONSTRAINT IF EXISTS agenda_pastoral_igreja_id_fkey;
ALTER TABLE public.agenda_pastoral
  ADD CONSTRAINT agenda_pastoral_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
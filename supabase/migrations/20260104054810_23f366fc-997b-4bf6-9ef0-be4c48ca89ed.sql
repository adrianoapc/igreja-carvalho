-- Migration: Adicionar FKs para igreja_id (Parte 1 - Cadastros)

-- alteracoes_perfil_pendentes
ALTER TABLE public.alteracoes_perfil_pendentes
  DROP CONSTRAINT IF EXISTS alteracoes_perfil_pendentes_igreja_id_fkey;
ALTER TABLE public.alteracoes_perfil_pendentes
  ADD CONSTRAINT alteracoes_perfil_pendentes_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- atendimentos_bot
ALTER TABLE public.atendimentos_bot
  DROP CONSTRAINT IF EXISTS atendimentos_bot_igreja_id_fkey;
ALTER TABLE public.atendimentos_bot
  ADD CONSTRAINT atendimentos_bot_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- atendimentos_pastorais
ALTER TABLE public.atendimentos_pastorais
  DROP CONSTRAINT IF EXISTS atendimentos_pastorais_igreja_id_fkey;
ALTER TABLE public.atendimentos_pastorais
  ADD CONSTRAINT atendimentos_pastorais_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- aulas
ALTER TABLE public.aulas
  DROP CONSTRAINT IF EXISTS aulas_igreja_id_fkey;
ALTER TABLE public.aulas
  ADD CONSTRAINT aulas_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- banners
ALTER TABLE public.banners
  DROP CONSTRAINT IF EXISTS banners_igreja_id_fkey;
ALTER TABLE public.banners
  ADD CONSTRAINT banners_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- bases_ministeriais
ALTER TABLE public.bases_ministeriais
  DROP CONSTRAINT IF EXISTS bases_ministeriais_igreja_id_fkey;
ALTER TABLE public.bases_ministeriais
  ADD CONSTRAINT bases_ministeriais_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- cancoes_culto
ALTER TABLE public.cancoes_culto
  DROP CONSTRAINT IF EXISTS cancoes_culto_igreja_id_fkey;
ALTER TABLE public.cancoes_culto
  ADD CONSTRAINT cancoes_culto_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- candidatos_voluntario
ALTER TABLE public.candidatos_voluntario
  DROP CONSTRAINT IF EXISTS candidatos_voluntario_igreja_id_fkey;
ALTER TABLE public.candidatos_voluntario
  ADD CONSTRAINT candidatos_voluntario_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- candidatos_voluntario_historico
ALTER TABLE public.candidatos_voluntario_historico
  DROP CONSTRAINT IF EXISTS candidatos_voluntario_historico_igreja_id_fkey;
ALTER TABLE public.candidatos_voluntario_historico
  ADD CONSTRAINT candidatos_voluntario_historico_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- categorias_financeiras
ALTER TABLE public.categorias_financeiras
  DROP CONSTRAINT IF EXISTS categorias_financeiras_igreja_id_fkey;
ALTER TABLE public.categorias_financeiras
  ADD CONSTRAINT categorias_financeiras_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- categorias_times
ALTER TABLE public.categorias_times
  DROP CONSTRAINT IF EXISTS categorias_times_igreja_id_fkey;
ALTER TABLE public.categorias_times
  ADD CONSTRAINT categorias_times_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
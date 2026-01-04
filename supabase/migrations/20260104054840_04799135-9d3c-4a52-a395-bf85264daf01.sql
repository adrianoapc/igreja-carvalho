-- Migration: Adicionar FKs para igreja_id (Parte 4)

-- liturgias
ALTER TABLE public.liturgias
  DROP CONSTRAINT IF EXISTS liturgias_igreja_id_fkey;
ALTER TABLE public.liturgias
  ADD CONSTRAINT liturgias_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- membro_funcoes
ALTER TABLE public.membro_funcoes
  DROP CONSTRAINT IF EXISTS membro_funcoes_igreja_id_fkey;
ALTER TABLE public.membro_funcoes
  ADD CONSTRAINT membro_funcoes_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- membros_time
ALTER TABLE public.membros_time
  DROP CONSTRAINT IF EXISTS membros_time_igreja_id_fkey;
ALTER TABLE public.membros_time
  ADD CONSTRAINT membros_time_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- midia_tags
ALTER TABLE public.midia_tags
  DROP CONSTRAINT IF EXISTS midia_tags_igreja_id_fkey;
ALTER TABLE public.midia_tags
  ADD CONSTRAINT midia_tags_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- midias
ALTER TABLE public.midias
  DROP CONSTRAINT IF EXISTS midias_igreja_id_fkey;
ALTER TABLE public.midias
  ADD CONSTRAINT midias_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- notifications
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_igreja_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- pedidos_oracao
ALTER TABLE public.pedidos_oracao
  DROP CONSTRAINT IF EXISTS pedidos_oracao_igreja_id_fkey;
ALTER TABLE public.pedidos_oracao
  ADD CONSTRAINT pedidos_oracao_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- posicoes_time
ALTER TABLE public.posicoes_time
  DROP CONSTRAINT IF EXISTS posicoes_time_igreja_id_fkey;
ALTER TABLE public.posicoes_time
  ADD CONSTRAINT posicoes_time_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- presencas_aula
ALTER TABLE public.presencas_aula
  DROP CONSTRAINT IF EXISTS presencas_aula_igreja_id_fkey;
ALTER TABLE public.presencas_aula
  ADD CONSTRAINT presencas_aula_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- profiles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_igreja_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
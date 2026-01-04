-- Migration: Adicionar FKs para igreja_id (Parte 3)

-- familias
ALTER TABLE public.familias
  DROP CONSTRAINT IF EXISTS familias_igreja_id_fkey;
ALTER TABLE public.familias
  ADD CONSTRAINT familias_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- formas_pagamento
ALTER TABLE public.formas_pagamento
  DROP CONSTRAINT IF EXISTS formas_pagamento_igreja_id_fkey;
ALTER TABLE public.formas_pagamento
  ADD CONSTRAINT formas_pagamento_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- fornecedores
ALTER TABLE public.fornecedores
  DROP CONSTRAINT IF EXISTS fornecedores_igreja_id_fkey;
ALTER TABLE public.fornecedores
  ADD CONSTRAINT fornecedores_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- funcoes_igreja
ALTER TABLE public.funcoes_igreja
  DROP CONSTRAINT IF EXISTS funcoes_igreja_igreja_id_fkey;
ALTER TABLE public.funcoes_igreja
  ADD CONSTRAINT funcoes_igreja_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- intercessores
ALTER TABLE public.intercessores
  DROP CONSTRAINT IF EXISTS intercessores_igreja_id_fkey;
ALTER TABLE public.intercessores
  ADD CONSTRAINT intercessores_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- itens_reembolso
ALTER TABLE public.itens_reembolso
  DROP CONSTRAINT IF EXISTS itens_reembolso_igreja_id_fkey;
ALTER TABLE public.itens_reembolso
  ADD CONSTRAINT itens_reembolso_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- jornadas
ALTER TABLE public.jornadas
  DROP CONSTRAINT IF EXISTS jornadas_igreja_id_fkey;
ALTER TABLE public.jornadas
  ADD CONSTRAINT jornadas_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- kids_checkins
ALTER TABLE public.kids_checkins
  DROP CONSTRAINT IF EXISTS kids_checkins_igreja_id_fkey;
ALTER TABLE public.kids_checkins
  ADD CONSTRAINT kids_checkins_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- liturgia_recursos
ALTER TABLE public.liturgia_recursos
  DROP CONSTRAINT IF EXISTS liturgia_recursos_igreja_id_fkey;
ALTER TABLE public.liturgia_recursos
  ADD CONSTRAINT liturgia_recursos_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);

-- liturgia_templates
ALTER TABLE public.liturgia_templates
  DROP CONSTRAINT IF EXISTS liturgia_templates_igreja_id_fkey;
ALTER TABLE public.liturgia_templates
  ADD CONSTRAINT liturgia_templates_igreja_id_fkey 
  FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
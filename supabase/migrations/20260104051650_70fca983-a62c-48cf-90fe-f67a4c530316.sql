-- =====================================================
-- MIGRAÇÃO SIMPLIFICADA: Multi-tenant com igreja_id
-- =====================================================

-- 1. Criar tabela de igrejas (tenant root)
CREATE TABLE IF NOT EXISTS public.igrejas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_igrejas_updated_at ON public.igrejas;
CREATE TRIGGER update_igrejas_updated_at
  BEFORE UPDATE ON public.igrejas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS em igrejas
ALTER TABLE public.igrejas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos podem ver igrejas" ON public.igrejas;
CREATE POLICY "Todos podem ver igrejas"
  ON public.igrejas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins podem gerenciar igrejas" ON public.igrejas;
CREATE POLICY "Admins podem gerenciar igrejas"
  ON public.igrejas FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Inserir igreja padrão e obter ID
DO $$
DECLARE
  v_igreja_id UUID;
BEGIN
  -- Verifica se já existe uma igreja
  SELECT id INTO v_igreja_id FROM public.igrejas LIMIT 1;
  
  IF v_igreja_id IS NULL THEN
    INSERT INTO public.igrejas (nome)
    VALUES ('Igreja Padrão')
    RETURNING id INTO v_igreja_id;
  END IF;
END $$;

-- 3. Adicionar igreja_id às tabelas principais (se não existir)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS igreja_id UUID;
ALTER TABLE public.configuracoes_igreja ADD COLUMN IF NOT EXISTS igreja_id UUID;

-- 4. Backfill: preencher igreja_id com a igreja padrão
DO $$
DECLARE
  v_igreja_id UUID;
BEGIN
  SELECT id INTO v_igreja_id FROM public.igrejas ORDER BY created_at ASC LIMIT 1;
  
  IF v_igreja_id IS NOT NULL THEN
    UPDATE public.profiles SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
    UPDATE public.eventos SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
    UPDATE public.configuracoes_igreja SET igreja_id = v_igreja_id WHERE igreja_id IS NULL;
  END IF;
END $$;

-- 5. Adicionar FKs (se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_igreja_id_fkey' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_igreja_id_fkey 
      FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'eventos_igreja_id_fkey' AND table_name = 'eventos'
  ) THEN
    ALTER TABLE public.eventos
      ADD CONSTRAINT eventos_igreja_id_fkey 
      FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'configuracoes_igreja_igreja_id_fkey' AND table_name = 'configuracoes_igreja'
  ) THEN
    ALTER TABLE public.configuracoes_igreja
      ADD CONSTRAINT configuracoes_igreja_igreja_id_fkey 
      FOREIGN KEY (igreja_id) REFERENCES public.igrejas(id);
  END IF;
END $$;

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_igreja_id ON public.profiles(igreja_id);
CREATE INDEX IF NOT EXISTS idx_eventos_igreja_id ON public.eventos(igreja_id);
CREATE INDEX IF NOT EXISTS idx_configuracoes_igreja_igreja_id ON public.configuracoes_igreja(igreja_id);

-- 7. Função helper para obter igreja_id do usuário logado
CREATE OR REPLACE FUNCTION public.get_current_user_igreja_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN (
    SELECT igreja_id 
    FROM public.profiles 
    WHERE user_id = auth.uid() 
    LIMIT 1
  );
END;
$$;
-- Adicionar campos de anonimato e identificação aos testemunhos
ALTER TABLE public.testemunhos 
  ALTER COLUMN autor_id DROP NOT NULL,
  ADD COLUMN anonimo boolean DEFAULT false,
  ADD COLUMN nome_externo text,
  ADD COLUMN email_externo text,
  ADD COLUMN telefone_externo text,
  ADD COLUMN pessoa_id uuid REFERENCES public.profiles(id);

-- Adicionar índice para busca de pessoa em testemunhos
CREATE INDEX idx_testemunhos_pessoa_id ON public.testemunhos(pessoa_id);

-- Adicionar campo pessoa_id aos pedidos de oração
ALTER TABLE public.pedidos_oracao
  ADD COLUMN pessoa_id uuid REFERENCES public.profiles(id);

-- Adicionar índice para busca de pessoa em pedidos de oração
CREATE INDEX idx_pedidos_oracao_pessoa_id ON public.pedidos_oracao(pessoa_id);

-- Função para buscar pessoa por contato (nome, email ou telefone)
CREATE OR REPLACE FUNCTION public.buscar_pessoa_por_contato(
  p_nome text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_telefone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pessoa_id uuid;
BEGIN
  -- Buscar por email (mais confiável)
  IF p_email IS NOT NULL THEN
    SELECT id INTO v_pessoa_id
    FROM public.profiles
    WHERE LOWER(email) = LOWER(p_email)
    LIMIT 1;
    
    IF v_pessoa_id IS NOT NULL THEN
      RETURN v_pessoa_id;
    END IF;
  END IF;
  
  -- Buscar por telefone (limpar formatação)
  IF p_telefone IS NOT NULL THEN
    SELECT id INTO v_pessoa_id
    FROM public.profiles
    WHERE REGEXP_REPLACE(telefone, '[^0-9]', '', 'g') = REGEXP_REPLACE(p_telefone, '[^0-9]', '', 'g')
    LIMIT 1;
    
    IF v_pessoa_id IS NOT NULL THEN
      RETURN v_pessoa_id;
    END IF;
  END IF;
  
  -- Buscar por nome (menos confiável)
  IF p_nome IS NOT NULL THEN
    SELECT id INTO v_pessoa_id
    FROM public.profiles
    WHERE LOWER(nome) = LOWER(p_nome)
    LIMIT 1;
    
    IF v_pessoa_id IS NOT NULL THEN
      RETURN v_pessoa_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$;
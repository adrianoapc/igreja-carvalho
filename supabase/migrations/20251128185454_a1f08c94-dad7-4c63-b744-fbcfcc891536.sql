-- Criar enum para tipos de pedido
CREATE TYPE tipo_pedido AS ENUM ('saude', 'familia', 'financeiro', 'trabalho', 'espiritual', 'agradecimento', 'outro');

-- Criar enum para status de pedido
CREATE TYPE status_pedido AS ENUM ('pendente', 'em_oracao', 'respondido', 'arquivado');

-- Criar tabela de intercessores
CREATE TABLE public.intercessores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  ativo BOOLEAN DEFAULT true,
  max_pedidos INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de pedidos de oração
CREATE TABLE public.pedidos_oracao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo tipo_pedido NOT NULL DEFAULT 'outro',
  status status_pedido NOT NULL DEFAULT 'pendente',
  anonimo BOOLEAN DEFAULT false,
  membro_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  intercessor_id UUID REFERENCES public.intercessores(id) ON DELETE SET NULL,
  nome_solicitante TEXT,
  email_solicitante TEXT,
  telefone_solicitante TEXT,
  pedido TEXT NOT NULL,
  observacoes_intercessor TEXT,
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_alocacao TIMESTAMP WITH TIME ZONE,
  data_resposta TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.intercessores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_oracao ENABLE ROW LEVEL SECURITY;

-- Policies para intercessores
CREATE POLICY "Admins podem ver todos os intercessores"
  ON public.intercessores FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem criar intercessores"
  ON public.intercessores FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar intercessores"
  ON public.intercessores FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar intercessores"
  ON public.intercessores FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Intercessores podem ver seu próprio perfil"
  ON public.intercessores FOR SELECT
  USING (auth.uid() = user_id);

-- Policies para pedidos de oração
CREATE POLICY "Admins podem ver todos os pedidos"
  ON public.pedidos_oracao FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Intercessores podem ver pedidos alocados a eles"
  ON public.pedidos_oracao FOR SELECT
  USING (
    intercessor_id IN (
      SELECT id FROM public.intercessores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Membros podem ver seus próprios pedidos"
  ON public.pedidos_oracao FOR SELECT
  USING (membro_id = auth.uid());

CREATE POLICY "Todos podem criar pedidos"
  ON public.pedidos_oracao FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins podem atualizar pedidos"
  ON public.pedidos_oracao FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Intercessores podem atualizar seus pedidos alocados"
  ON public.pedidos_oracao FOR UPDATE
  USING (
    intercessor_id IN (
      SELECT id FROM public.intercessores WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins podem deletar pedidos"
  ON public.pedidos_oracao FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Triggers para updated_at
CREATE TRIGGER update_intercessores_updated_at
  BEFORE UPDATE ON public.intercessores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pedidos_oracao_updated_at
  BEFORE UPDATE ON public.pedidos_oracao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para distribuir pedidos de forma balanceada
CREATE OR REPLACE FUNCTION public.alocar_pedido_balanceado(p_pedido_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_intercessor_id UUID;
BEGIN
  -- Buscar intercessor ativo com menos pedidos alocados
  SELECT i.id INTO v_intercessor_id
  FROM public.intercessores i
  LEFT JOIN (
    SELECT intercessor_id, COUNT(*) as total_pedidos
    FROM public.pedidos_oracao
    WHERE status IN ('pendente', 'em_oracao')
    GROUP BY intercessor_id
  ) p ON i.id = p.intercessor_id
  WHERE i.ativo = true
    AND (p.total_pedidos IS NULL OR p.total_pedidos < i.max_pedidos)
  ORDER BY COALESCE(p.total_pedidos, 0) ASC, i.created_at ASC
  LIMIT 1;
  
  -- Se encontrou um intercessor, alocar o pedido
  IF v_intercessor_id IS NOT NULL THEN
    UPDATE public.pedidos_oracao
    SET 
      intercessor_id = v_intercessor_id,
      status = 'em_oracao',
      data_alocacao = now()
    WHERE id = p_pedido_id;
  END IF;
  
  RETURN v_intercessor_id;
END;
$$;

-- Índices para performance
CREATE INDEX idx_pedidos_oracao_intercessor ON public.pedidos_oracao(intercessor_id);
CREATE INDEX idx_pedidos_oracao_membro ON public.pedidos_oracao(membro_id);
CREATE INDEX idx_pedidos_oracao_status ON public.pedidos_oracao(status);
CREATE INDEX idx_intercessores_ativo ON public.intercessores(ativo);
CREATE INDEX idx_intercessores_user_id ON public.intercessores(user_id);
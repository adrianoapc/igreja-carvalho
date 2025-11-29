-- Tabela de Contas (bancárias ou físicas/virtuais)
CREATE TABLE public.contas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('bancaria', 'fisica', 'virtual')),
  saldo_inicial DECIMAL(15,2) NOT NULL DEFAULT 0,
  saldo_atual DECIMAL(15,2) NOT NULL DEFAULT 0,
  banco TEXT,
  agencia TEXT,
  conta_numero TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Bases Ministeriais (Unidades de Negócio)
CREATE TABLE public.bases_ministeriais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  responsavel_id UUID REFERENCES public.profiles(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Centros de Custo
CREATE TABLE public.centros_custo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  base_ministerial_id UUID REFERENCES public.bases_ministeriais(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Categorias Financeiras
CREATE TABLE public.categorias_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  secao_dre TEXT,
  cor TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Subcategorias Financeiras
CREATE TABLE public.subcategorias_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria_id UUID NOT NULL REFERENCES public.categorias_financeiras(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Fornecedores
CREATE TABLE public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo_pessoa TEXT NOT NULL CHECK (tipo_pessoa IN ('fisica', 'juridica')),
  cpf_cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Transações Financeiras (Entradas e Saídas)
CREATE TABLE public.transacoes_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  tipo_lancamento TEXT NOT NULL CHECK (tipo_lancamento IN ('unico', 'recorrente', 'parcelado')),
  descricao TEXT NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  data_competencia DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  
  conta_id UUID NOT NULL REFERENCES public.contas(id),
  categoria_id UUID REFERENCES public.categorias_financeiras(id),
  subcategoria_id UUID REFERENCES public.subcategorias_financeiras(id),
  centro_custo_id UUID REFERENCES public.centros_custo(id),
  base_ministerial_id UUID REFERENCES public.bases_ministeriais(id),
  fornecedor_id UUID REFERENCES public.fornecedores(id),
  
  forma_pagamento TEXT,
  numero_parcela INTEGER,
  total_parcelas INTEGER,
  
  recorrencia TEXT CHECK (recorrencia IN ('diaria', 'semanal', 'quinzenal', 'mensal', 'bimestral')),
  data_fim_recorrencia DATE,
  
  anexo_url TEXT,
  observacoes TEXT,
  
  lancado_por UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bases_ministeriais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategorias_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes_financeiras ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admins e Tesoureiros têm acesso completo
CREATE POLICY "Admins e tesoureiros podem gerenciar contas"
  ON public.contas FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'));

CREATE POLICY "Admins e tesoureiros podem gerenciar bases ministeriais"
  ON public.bases_ministeriais FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'));

CREATE POLICY "Admins e tesoureiros podem gerenciar centros de custo"
  ON public.centros_custo FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'));

CREATE POLICY "Admins e tesoureiros podem gerenciar categorias"
  ON public.categorias_financeiras FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'));

CREATE POLICY "Admins e tesoureiros podem gerenciar subcategorias"
  ON public.subcategorias_financeiras FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'));

CREATE POLICY "Admins e tesoureiros podem gerenciar fornecedores"
  ON public.fornecedores FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'));

CREATE POLICY "Admins e tesoureiros podem gerenciar transações"
  ON public.transacoes_financeiras FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'tesoureiro'));

-- Triggers para updated_at
CREATE TRIGGER update_contas_updated_at
  BEFORE UPDATE ON public.contas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bases_ministeriais_updated_at
  BEFORE UPDATE ON public.bases_ministeriais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_centros_custo_updated_at
  BEFORE UPDATE ON public.centros_custo
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categorias_financeiras_updated_at
  BEFORE UPDATE ON public.categorias_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subcategorias_financeiras_updated_at
  BEFORE UPDATE ON public.subcategorias_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fornecedores_updated_at
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transacoes_financeiras_updated_at
  BEFORE UPDATE ON public.transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para atualizar saldo da conta quando uma transação é paga
CREATE OR REPLACE FUNCTION public.atualizar_saldo_conta()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a transação foi marcada como paga
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual + NEW.valor
      WHERE id = NEW.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual - NEW.valor
      WHERE id = NEW.conta_id;
    END IF;
  -- Se a transação foi cancelada ou voltou para pendente
  ELSIF OLD.status = 'pago' AND NEW.status != 'pago' THEN
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual - OLD.valor
      WHERE id = OLD.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual + OLD.valor
      WHERE id = OLD.conta_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para atualizar saldo automaticamente
CREATE TRIGGER trigger_atualizar_saldo_conta
  AFTER UPDATE OF status ON public.transacoes_financeiras
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_saldo_conta();
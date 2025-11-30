-- Criar tabela de templates de liturgia
CREATE TABLE IF NOT EXISTS public.templates_liturgia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de itens dos templates
CREATE TABLE IF NOT EXISTS public.itens_template_liturgia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.templates_liturgia(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  duracao_minutos INTEGER,
  responsavel_externo TEXT,
  midias_ids UUID[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.templates_liturgia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_template_liturgia ENABLE ROW LEVEL SECURITY;

-- Políticas para templates_liturgia
CREATE POLICY "Admins podem gerenciar templates"
ON public.templates_liturgia
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver templates ativos"
ON public.templates_liturgia
FOR SELECT
TO authenticated
USING (ativo = true OR has_role(auth.uid(), 'admin'::app_role));

-- Políticas para itens_template_liturgia
CREATE POLICY "Admins podem gerenciar itens de templates"
ON public.itens_template_liturgia
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver itens de templates ativos"
ON public.itens_template_liturgia
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.templates_liturgia
    WHERE id = itens_template_liturgia.template_id
    AND (ativo = true OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_templates_liturgia_updated_at
BEFORE UPDATE ON public.templates_liturgia
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_itens_template_liturgia_updated_at
BEFORE UPDATE ON public.itens_template_liturgia
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
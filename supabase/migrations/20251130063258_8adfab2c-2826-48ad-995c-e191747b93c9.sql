-- Adicionar campos de culto aos templates
ALTER TABLE public.templates_liturgia 
ADD COLUMN IF NOT EXISTS tipo_culto TEXT,
ADD COLUMN IF NOT EXISTS tema_padrao TEXT,
ADD COLUMN IF NOT EXISTS local_padrao TEXT,
ADD COLUMN IF NOT EXISTS duracao_padrao INTEGER,
ADD COLUMN IF NOT EXISTS pregador_padrao TEXT,
ADD COLUMN IF NOT EXISTS observacoes_padrao TEXT,
ADD COLUMN IF NOT EXISTS incluir_escalas BOOLEAN DEFAULT false;

-- Criar tabela de escalas dos templates
CREATE TABLE IF NOT EXISTS public.escalas_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.templates_liturgia(id) ON DELETE CASCADE,
  time_id UUID NOT NULL REFERENCES public.times_culto(id) ON DELETE CASCADE,
  posicao_id UUID REFERENCES public.posicoes_time(id) ON DELETE SET NULL,
  pessoa_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.escalas_template ENABLE ROW LEVEL SECURITY;

-- Políticas para escalas_template
CREATE POLICY "Admins podem gerenciar escalas de templates"
ON public.escalas_template
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Membros podem ver escalas de templates ativos"
ON public.escalas_template
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.templates_liturgia
    WHERE id = escalas_template.template_id
    AND (ativo = true OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_escalas_template_updated_at
BEFORE UPDATE ON public.escalas_template
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Renomear tabela para refletir novo propósito
ALTER TABLE public.templates_liturgia RENAME TO templates_culto;
ALTER TABLE public.itens_template_liturgia RENAME TO itens_template_culto;

-- Atualizar foreign keys após rename
ALTER TABLE public.itens_template_culto 
DROP CONSTRAINT IF EXISTS itens_template_liturgia_template_id_fkey,
ADD CONSTRAINT itens_template_culto_template_id_fkey 
FOREIGN KEY (template_id) REFERENCES public.templates_culto(id) ON DELETE CASCADE;

ALTER TABLE public.escalas_template 
DROP CONSTRAINT IF EXISTS escalas_template_template_id_fkey,
ADD CONSTRAINT escalas_template_template_id_fkey 
FOREIGN KEY (template_id) REFERENCES public.templates_culto(id) ON DELETE CASCADE;
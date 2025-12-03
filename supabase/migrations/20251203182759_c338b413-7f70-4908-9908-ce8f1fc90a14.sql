-- 1. Criar o Bucket para imagens (se ainda não existir)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('comunicados', 'comunicados', true)
ON CONFLICT (id) DO NOTHING;

-- Política de Storage: Qualquer logado vê, Admins gerenciam
CREATE POLICY "comunicados_public_access" ON storage.objects FOR SELECT USING (bucket_id = 'comunicados');
CREATE POLICY "comunicados_admin_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'comunicados' AND auth.role() = 'authenticated');
CREATE POLICY "comunicados_admin_update" ON storage.objects FOR UPDATE USING (bucket_id = 'comunicados' AND auth.role() = 'authenticated');
CREATE POLICY "comunicados_admin_delete" ON storage.objects FOR DELETE USING (bucket_id = 'comunicados' AND auth.role() = 'authenticated');

-- 2. Criar o Tipo (Enum)
CREATE TYPE public.tipo_comunicado AS ENUM ('banner', 'alerta');

-- 3. Criar a Tabela Unificada
CREATE TABLE public.comunicados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  imagem_url TEXT,
  
  tipo public.tipo_comunicado NOT NULL DEFAULT 'alerta',
  
  nivel_urgencia TEXT DEFAULT 'info',
  link_acao TEXT,
  
  ativo BOOLEAN DEFAULT true,
  data_inicio TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_fim TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 4. Segurança (RLS)
ALTER TABLE public.comunicados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comunicados_leitura_publica" ON public.comunicados
FOR SELECT USING (
  ativo = true 
  AND data_inicio <= now() 
  AND (data_fim IS NULL OR data_fim >= now())
);

CREATE POLICY "comunicados_gestao_admin" ON public.comunicados
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Trigger para updated_at
CREATE TRIGGER update_comunicados_updated_at
  BEFORE UPDATE ON public.comunicados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
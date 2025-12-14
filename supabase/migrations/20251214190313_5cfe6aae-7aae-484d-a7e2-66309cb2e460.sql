-- 2. Criar tabela de Configurações Globais (Singleton - apenas 1 linha)
CREATE TABLE IF NOT EXISTS public.app_config (
  id INT PRIMARY KEY DEFAULT 1,
  maintenance_mode BOOLEAN DEFAULT false,
  maintenance_message TEXT DEFAULT 'O sistema está em manutenção programada. Voltamos em breve.',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  CONSTRAINT single_row_config CHECK (id = 1)
);

-- 3. Inserir a configuração inicial (Modo Manutenção DESLIGADO)
INSERT INTO public.app_config (id, maintenance_mode)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

-- 4. Configurar Segurança (RLS) para a Configuração
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Todos podem ler se o sistema está fora do ar
CREATE POLICY "Leitura pública de config" 
ON public.app_config FOR SELECT 
USING (true);

-- Apenas Admin e Técnico podem alterar o status do sistema
CREATE POLICY "Admin e Tecnico gerenciam config" 
ON public.app_config FOR UPDATE 
TO authenticated 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'tecnico'::app_role)
);

-- 5. Atualizar permissões existentes para incluir o 'tecnico'
CREATE POLICY "Tecnico ver perfis" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (
  has_role(auth.uid(), 'tecnico'::app_role)
);
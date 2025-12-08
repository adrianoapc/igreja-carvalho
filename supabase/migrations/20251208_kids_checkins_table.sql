-- Criar tabela para gerenciar check-in/check-out do Kids
CREATE TABLE IF NOT EXISTS public.kids_checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crianca_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  responsavel_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  culto_id UUID REFERENCES public.cultos(id) ON DELETE SET NULL,
  checkin_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  checkout_at TIMESTAMP WITH TIME ZONE,
  checkin_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  checkout_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_kids_checkins_crianca ON public.kids_checkins(crianca_id);
CREATE INDEX idx_kids_checkins_responsavel ON public.kids_checkins(responsavel_id);
CREATE INDEX idx_kids_checkins_ativo ON public.kids_checkins(crianca_id) WHERE checkout_at IS NULL;

-- RLS
ALTER TABLE public.kids_checkins ENABLE ROW LEVEL SECURITY;

-- Líderes podem fazer check-in/check-out
CREATE POLICY "Lideres gerenciam kids checkins" ON public.kids_checkins
  FOR ALL 
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'lider'::app_role) OR
    has_role(auth.uid(), 'secretario'::app_role)
  );

-- Pais podem ver check-ins dos próprios filhos
CREATE POLICY "Pais veem checkins dos filhos" ON public.kids_checkins
  FOR SELECT
  USING (
    responsavel_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Pais podem fazer check-out dos próprios filhos
CREATE POLICY "Pais podem fazer checkout dos filhos" ON public.kids_checkins
  FOR UPDATE
  USING (
    responsavel_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    AND checkout_at IS NULL
  )
  WITH CHECK (
    responsavel_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_kids_checkins_updated_at
  BEFORE UPDATE ON public.kids_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- View para checkins ativos
CREATE OR REPLACE VIEW public.view_kids_checkins_ativos AS
SELECT 
  kc.id,
  kc.crianca_id,
  c.nome as crianca_nome,
  c.avatar_url as crianca_avatar,
  c.data_nascimento as crianca_data_nascimento,
  c.alergias as crianca_alergias,
  kc.responsavel_id,
  r.nome as responsavel_nome,
  kc.checkin_at,
  kc.checkin_por,
  cp.nome as checkin_por_nome,
  kc.culto_id
FROM public.kids_checkins kc
JOIN public.profiles c ON c.id = kc.crianca_id
JOIN public.profiles r ON r.id = kc.responsavel_id
LEFT JOIN public.profiles cp ON cp.id = kc.checkin_por
WHERE kc.checkout_at IS NULL
ORDER BY kc.checkin_at DESC;

-- Permitir SELECT na view para pais e líderes
CREATE POLICY "View kids checkins ativos readable" ON public.view_kids_checkins_ativos
  FOR SELECT
  USING (
    responsavel_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
    OR has_role(auth.uid(), 'secretario'::app_role)
  );

-- ======================================================================
-- INTEGRAÇÃO: Registrar presença no culto automaticamente após checkout
-- ======================================================================

-- Função para criar presença no culto quando criança faz checkout
CREATE OR REPLACE FUNCTION public.registrar_presenca_culto_kids()
RETURNS TRIGGER AS $$
BEGIN
  -- Só processa se o checkout foi agora (não era nulo e agora é preenchido)
  IF OLD.checkout_at IS NULL AND NEW.checkout_at IS NOT NULL THEN
    
    -- Só registra se houver culto vinculado
    IF NEW.culto_id IS NOT NULL THEN
      
      -- 1. Registrar presença da CRIANÇA
      INSERT INTO public.presencas_culto (
        culto_id,
        pessoa_id,
        tipo_registro
      )
      VALUES (
        NEW.culto_id,
        NEW.crianca_id,
        'kids'
      )
      ON CONFLICT (culto_id, pessoa_id) DO NOTHING;
      
      -- 2. Registrar presença do RESPONSÁVEL (pai/mãe que trouxe)
      INSERT INTO public.presencas_culto (
        culto_id,
        pessoa_id,
        tipo_registro
      )
      VALUES (
        NEW.culto_id,
        NEW.responsavel_id,
        'adulto'
      )
      ON CONFLICT (culto_id, pessoa_id) DO NOTHING;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que dispara após checkout
CREATE TRIGGER kids_checkout_registra_presenca
  AFTER UPDATE OF checkout_at ON public.kids_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_presenca_culto_kids();

-- Comentários para documentação
COMMENT ON FUNCTION public.registrar_presenca_culto_kids() IS 
  'Registra automaticamente a presença da CRIANÇA e do RESPONSÁVEL no culto após 
   o checkout do Kids. Isso garante que tanto o pai quanto o filho tenham presença 
   registrada automaticamente. Mantém histórico consolidado em presencas_culto 
   enquanto kids_checkins controla custódia em tempo real.';

COMMENT ON TRIGGER kids_checkout_registra_presenca ON public.kids_checkins IS
  'Trigger que integra kids_checkins com presencas_culto. Quando uma criança 
   faz checkout, registra presença da criança (tipo_registro=kids) e do 
   responsável (tipo_registro=adulto) automaticamente no culto.';

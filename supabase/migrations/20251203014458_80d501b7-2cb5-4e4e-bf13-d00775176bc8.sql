-- Adicionar coluna validado_por para rastrear quem validou a presença
ALTER TABLE public.presencas_culto 
ADD COLUMN IF NOT EXISTS validado_por UUID REFERENCES public.profiles(user_id);

-- Remover a constraint anterior do metodo_checkin se existir
ALTER TABLE public.presencas_culto 
DROP CONSTRAINT IF EXISTS presencas_culto_metodo_checkin_check;

-- Renomear coluna metodo_checkin para metodo se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'presencas_culto' 
    AND column_name = 'metodo_checkin'
  ) THEN
    ALTER TABLE public.presencas_culto RENAME COLUMN metodo_checkin TO metodo;
  END IF;
  
  -- Adicionar coluna metodo se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'presencas_culto' 
    AND column_name = 'metodo'
  ) THEN
    ALTER TABLE public.presencas_culto ADD COLUMN metodo TEXT;
  END IF;
END $$;

-- Remover coluna tipo_registro antiga se existir
ALTER TABLE public.presencas_culto DROP COLUMN IF EXISTS tipo_registro;

-- Adicionar nova constraint para os valores de metodo permitidos
ALTER TABLE public.presencas_culto 
ADD CONSTRAINT presencas_culto_metodo_check 
CHECK (metodo IN ('lider_celula', 'lider_ministerio', 'qrcode', 'manual', 'whatsapp_geo'));

-- Comentário na tabela para documentação
COMMENT ON TABLE public.presencas_culto IS 'Registra presenças em cultos, validadas por QR Code, líderes ou manualmente';
COMMENT ON COLUMN public.presencas_culto.validado_por IS 'ID do usuário que validou a presença (líder ou o próprio membro via QR)';
COMMENT ON COLUMN public.presencas_culto.metodo IS 'Método de check-in: lider_celula, lider_ministerio, qrcode, manual, whatsapp_geo';
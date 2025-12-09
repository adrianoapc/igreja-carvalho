-- ======================================================================
-- Migration: Move Kids Presence Recording from Checkout to Check-in
-- ======================================================================
-- 
-- OBJETIVO: Registrar presença no culto IMEDIATAMENTE quando o pai bipar 
-- o QR Code na ENTRADA do Kids (check-in), e não mais no checkout.
--
-- MOTIVO: Garantir que o Dashboard geral da Igreja tenha números em tempo 
-- real, refletindo presença de crianças e adultos logo que entram.
--
-- ======================================================================

-- 1. DROP da lógica antiga
-- ======================

-- Remover o trigger que disparava no checkout
DROP TRIGGER IF EXISTS kids_checkout_registra_presenca ON public.kids_checkins;

-- Remover a função associada
DROP FUNCTION IF EXISTS public.registrar_presenca_culto_kids() CASCADE;

-- 2. NOVA FUNÇÃO: Registrar presença na ENTRADA
-- ==============================================

CREATE OR REPLACE FUNCTION public.registrar_presenca_entrada_kids()
RETURNS TRIGGER AS $$
BEGIN
  -- Só processa se houver um culto vinculado (ou seja, existe um culto ocorrendo)
  IF NEW.culto_id IS NOT NULL THEN
    
    -- 1. Registrar presença da CRIANÇA
    INSERT INTO public.presencas_culto (
      culto_id,
      pessoa_id,
      tipo_registro,
      metodo,
      created_at
    )
    VALUES (
      NEW.culto_id,
      NEW.crianca_id,
      'kids',
      'qrcode',
      now()
    )
    ON CONFLICT (culto_id, pessoa_id) DO NOTHING;
    
    -- 2. Registrar presença do RESPONSÁVEL (pai/mãe que levou)
    INSERT INTO public.presencas_culto (
      culto_id,
      pessoa_id,
      tipo_registro,
      metodo,
      created_at
    )
    VALUES (
      NEW.culto_id,
      NEW.responsavel_id,
      'adulto',
      'qrcode',
      now()
    )
    ON CONFLICT (culto_id, pessoa_id) DO NOTHING;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. NOVO TRIGGER: Executa na ENTRADA (AFTER INSERT)
-- ===================================================

CREATE TRIGGER kids_checkin_registra_presenca
  AFTER INSERT ON public.kids_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.registrar_presenca_entrada_kids();

-- 4. Documentação
-- ===============

COMMENT ON FUNCTION public.registrar_presenca_entrada_kids() IS 
  'Registra automaticamente a presença da CRIANÇA e do RESPONSÁVEL no culto 
   assim que o check-in (entrada) é realizado no Kids. 
   
   TIMING: AFTER INSERT em kids_checkins (check-in)
   
   LÓGICA:
   - Se existe culto_id (um culto está ocorrendo), insere 2 registros:
     1. Criança (tipo_registro=''kids'', metodo=''qrcode'')
     2. Responsável (tipo_registro=''adulto'', metodo=''qrcode'')
   - ON CONFLICT DO NOTHING: evita erro se a pessoa já foi bipada na porta
   
   IMPACTO:
   - Dashboard geral reflete presença em tempo real
   - Contagem de crianças e adultos sobe imediatamente ao check-in
   - Checkout agora é apenas para custódia/saída, sem interferir em presença';

COMMENT ON TRIGGER kids_checkin_registra_presenca ON public.kids_checkins IS
  'Trigger que integra kids_checkins com presencas_culto. 
   Quando uma criança é feita check-in no Kids (entrada), registra presença 
   da criança e responsável automaticamente no culto.
   
   Antes: Presença era gravada no CHECKOUT
   Agora: Presença é gravada no CHECK-IN (entrada)';

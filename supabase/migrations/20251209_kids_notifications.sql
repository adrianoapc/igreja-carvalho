-- ======================================================================
-- Migration: Kids Notifications (Diário e Check-out)
-- ======================================================================
--
-- OBJETIVO: Notificar pais/responsáveis via push no app quando:
-- 1. Professor registra o Diário de Classe
-- 2. Criança faz check-out do Kids
--
-- TABELAS AFETADAS:
-- - notifications (insere registros de notificação)
-- - kids_diario (trigger na inserção)
-- - kids_checkins (trigger na atualização de checkout_at)
--
-- ======================================================================

-- 1. FUNÇÃO: Notificar sobre Diário de Classe
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_kids_diario()
RETURNS TRIGGER AS $$
DECLARE
  v_crianca_nome TEXT;
  v_responsavel_id UUID;
  v_responsavel_user_id UUID;
BEGIN
  -- Buscar nome da criança
  SELECT p.nome INTO v_crianca_nome
  FROM public.profiles p
  WHERE p.id = NEW.crianca_id;

  -- Buscar responsável via tabela familias
  -- Procura pelo primeiro responsável (tipo_parentesco = 'pai', 'mãe', 'responsável', etc)
  SELECT f.familiar_id INTO v_responsavel_id
  FROM public.familias f
  WHERE f.pessoa_id = NEW.crianca_id
    AND f.tipo_parentesco IN ('pai', 'mãe', 'responsável', 'pais', 'tutor')
  LIMIT 1;

  -- Se não encontrou via familias, tenta via campo responsavel_id no profile da criança
  IF v_responsavel_id IS NULL THEN
    SELECT responsavel_id INTO v_responsavel_id
    FROM public.profiles
    WHERE id = NEW.crianca_id;
  END IF;

  -- Se encontrou um responsável, buscar seu user_id
  IF v_responsavel_id IS NOT NULL THEN
    SELECT user_id INTO v_responsavel_user_id
    FROM public.profiles
    WHERE id = v_responsavel_id;

    -- Se responsável tem user_id vinculado, criar notificação
    IF v_responsavel_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        metadata
      ) VALUES (
        v_responsavel_user_id,
        'Notícia do Kids! 🎨',
        'O diário de ' || COALESCE(v_crianca_nome, 'sua criança') || ' foi atualizado. Veja como foi o culto hoje!',
        'kids_diario',
        jsonb_build_object(
          'crianca_id', NEW.crianca_id,
          'diario_id', NEW.id,
          'culto_id', NEW.culto_id,
          'data', NEW.data
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. FUNÇÃO: Notificar sobre Check-out da Criança
-- ===============================================

CREATE OR REPLACE FUNCTION public.notify_kids_checkout()
RETURNS TRIGGER AS $$
DECLARE
  v_crianca_nome TEXT;
  v_responsavel_user_id UUID;
BEGIN
  -- Só processa se foi feito checkout (transição de NULL para timestamp)
  IF OLD.checkout_at IS NULL AND NEW.checkout_at IS NOT NULL THEN
    
    -- Buscar nome da criança
    SELECT p.nome INTO v_crianca_nome
    FROM public.profiles p
    WHERE p.id = NEW.crianca_id;

    -- Buscar user_id do responsável
    SELECT p.user_id INTO v_responsavel_user_id
    FROM public.profiles p
    WHERE p.id = NEW.responsavel_id;

    -- Se responsável tem user_id vinculado, criar notificação
    IF v_responsavel_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        metadata
      ) VALUES (
        v_responsavel_user_id,
        'Saída Confirmada ✅',
        'O check-out de ' || COALESCE(v_crianca_nome, 'sua criança') || ' foi realizado com sucesso. Até a próxima!',
        'kids_checkout',
        jsonb_build_object(
          'crianca_id', NEW.crianca_id,
          'checkin_id', NEW.id,
          'checkout_at', NEW.checkout_at,
          'checkout_por', NEW.checkout_por
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. TRIGGER: Notificação ao registrar Diário
-- ===========================================

CREATE TRIGGER trigger_notify_kids_diario
  AFTER INSERT ON public.kids_diario
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_kids_diario();

COMMENT ON TRIGGER trigger_notify_kids_diario ON public.kids_diario IS
  'Dispara uma notificação para o responsável quando o professor registra o diário de classe da criança.
   Título: "Notícia do Kids! 🎨"
   Mensagem inclui o nome da criança e convida a ver detalhes do culto.';

-- 4. TRIGGER: Notificação ao fazer Check-out
-- ===========================================

CREATE TRIGGER trigger_notify_kids_checkout
  AFTER UPDATE ON public.kids_checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_kids_checkout();

COMMENT ON TRIGGER trigger_notify_kids_checkout ON public.kids_checkins IS
  'Dispara uma notificação para o responsável quando a criança faz check-out do Kids.
   Só dispara se checkout_at transiciona de NULL para um timestamp válido (saída confirmada).
   Título: "Saída Confirmada ✅"';

-- 5. Documentação
-- ===============

COMMENT ON FUNCTION public.notify_kids_diario() IS
  'Notifica o responsável quando um diário de classe é registrado para a criança.

   TRIGGER: Dispara AFTER INSERT em kids_diario

   LÓGICA:
   1. Busca o nome da criança em profiles
   2. Procura responsável via tabela familias (primeiro com tipo_parentesco = pai/mãe/responsável)
   3. Fallback: Tenta campo responsavel_id no perfil da criança
   4. Se responsável tem user_id vinculado, insere notificação em notifications

   NOTIFICAÇÃO:
   - Título: "Notícia do Kids! 🎨"
   - Tipo: "kids_diario"
   - Metadata: { crianca_id, diario_id, culto_id, data }

   TIMING: Imediato após INSERT
   DESTINATÁRIO: Responsável da criança';

COMMENT ON FUNCTION public.notify_kids_checkout() IS
  'Notifica o responsável quando a criança faz check-out do Kids.

   TRIGGER: Dispara AFTER UPDATE em kids_checkins
   CONDIÇÃO: OLD.checkout_at IS NULL AND NEW.checkout_at IS NOT NULL

   LÓGICA:
   1. Verifica se é uma transição de saída (checkout_at vai de NULL para timestamp)
   2. Busca nome da criança e user_id do responsável
   3. Insere notificação em notifications

   NOTIFICAÇÃO:
   - Título: "Saída Confirmada ✅"
   - Tipo: "kids_checkout"
   - Metadata: { crianca_id, checkin_id, checkout_at, checkout_por }

   TIMING: Imediato após UPDATE de checkout
   DESTINATÁRIO: Responsável da criança';

-- 6. Índices para melhor performance
-- ==================================

CREATE INDEX idx_notifications_type_created ON public.notifications(type, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id, read) WHERE read = false;

-- ======================================================================
-- OBSERVAÇÕES:
-- ======================================================================
--
-- 1. RESPONSÁVEL:
--    - Procura primeiro na tabela familias com tipo_parentesco específico
--    - Fallback para campo responsavel_id do profile da criança
--    - Se responsável não tem user_id vinculado, nenhuma notificação é enviada
--
-- 2. INTEGRAÇÃO PUSH:
--    - As notificações são inseridas em notifications
--    - O app deve estar configurado com Supabase Realtime para receber push
--    - Implemente listener de realtime em useNotifications.ts:
--      - subscribe('realtime', 'notifications', { event: 'INSERT' })
--      - Use react-native-push-notification ou equivalente no app
--
-- 3. METADADOS:
--    - Armazenam contexto para ações rápidas (deep linking)
--    - Diário: crianca_id, diario_id para abrir o diário direto
--    - Checkout: checkin_id, checkout_por para mostrar quem fez checkout
--
-- 4. CUSTOMIZAÇÃO FUTURA:
--    - Adicionar foto da criança ou avatar em metadata para notificação visual
--    - Incluir dados comportamentais/emocionais no texto da notificação
--    - Implementar delays para batch de notificações (ex: enviar 1x por dia)
--
-- ======================================================================

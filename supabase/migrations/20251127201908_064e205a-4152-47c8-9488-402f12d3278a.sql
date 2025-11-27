-- Criar tabela de notificações
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'novo_visitante', 'promocao_status', 'atribuicao_cargo'
  read BOOLEAN DEFAULT false,
  related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies para notificações
CREATE POLICY "Usuários podem ver suas notificações"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas notificações"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode criar notificações"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Índices para performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Função para criar notificação para admins
CREATE OR REPLACE FUNCTION public.notify_admins(
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_related_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criar notificação para todos os admins
  INSERT INTO public.notifications (user_id, title, message, type, related_user_id, metadata)
  SELECT 
    ur.user_id,
    p_title,
    p_message,
    p_type,
    p_related_user_id,
    p_metadata
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
END;
$$;

-- Trigger para notificar quando novo perfil é criado (novo visitante)
CREATE OR REPLACE FUNCTION public.notify_new_visitor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só notificar se for visitante
  IF NEW.status = 'visitante' THEN
    PERFORM public.notify_admins(
      'Novo Visitante',
      format('Novo visitante cadastrado: %s', NEW.nome),
      'novo_visitante',
      NEW.user_id,
      jsonb_build_object('nome', NEW.nome, 'email', NEW.email)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_new_visitor
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_visitor();

-- Trigger para notificar promoção de status
CREATE OR REPLACE FUNCTION public.notify_status_promotion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message TEXT;
BEGIN
  -- Verificar se houve mudança de status
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Construir mensagem baseada na mudança
    IF NEW.status = 'frequentador' THEN
      v_message := format('%s foi promovido a Frequentador', NEW.nome);
    ELSIF NEW.status = 'membro' THEN
      v_message := format('%s foi promovido a Membro', NEW.nome);
    ELSE
      v_message := format('Status de %s foi alterado para %s', NEW.nome, NEW.status);
    END IF;
    
    -- Notificar admins
    PERFORM public.notify_admins(
      'Promoção de Status',
      v_message,
      'promocao_status',
      NEW.user_id,
      jsonb_build_object(
        'nome', NEW.nome,
        'email', NEW.email,
        'status_anterior', OLD.status,
        'status_novo', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_status_promotion
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_status_promotion();

-- Trigger para notificar atribuição de cargo
CREATE OR REPLACE FUNCTION public.notify_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  -- Buscar nome do usuário
  SELECT nome INTO v_user_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  
  -- Notificar admins
  PERFORM public.notify_admins(
    'Novo Cargo Atribuído',
    format('Cargo "%s" foi atribuído a %s', NEW.role, COALESCE(v_user_name, 'usuário')),
    'atribuicao_cargo',
    NEW.user_id,
    jsonb_build_object(
      'nome', v_user_name,
      'cargo', NEW.role
    )
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_role_assignment
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.notify_role_assignment();

-- Trigger para notificar remoção de cargo
CREATE OR REPLACE FUNCTION public.notify_role_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  -- Buscar nome do usuário
  SELECT nome INTO v_user_name
  FROM public.profiles
  WHERE user_id = OLD.user_id;
  
  -- Notificar admins
  PERFORM public.notify_admins(
    'Cargo Removido',
    format('Cargo "%s" foi removido de %s', OLD.role, COALESCE(v_user_name, 'usuário')),
    'atribuicao_cargo',
    OLD.user_id,
    jsonb_build_object(
      'nome', v_user_name,
      'cargo', OLD.role,
      'acao', 'removido'
    )
  );
  
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_notify_role_removal
AFTER DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.notify_role_removal();

-- Enable realtime para notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
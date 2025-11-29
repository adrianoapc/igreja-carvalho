-- Atualizar função para notificar novo testemunho com suporte a anonimização
CREATE OR REPLACE FUNCTION public.notify_new_testemunho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_autor_nome TEXT;
  v_display_nome TEXT;
BEGIN
  -- Buscar nome do autor
  SELECT nome INTO v_autor_nome
  FROM public.profiles
  WHERE id = NEW.autor_id;
  
  -- Se for anônimo, usar "Anônimo" ao invés do nome real
  IF NEW.anonimo = true THEN
    v_display_nome := 'Anônimo';
  ELSE
    v_display_nome := COALESCE(v_autor_nome, 'autor desconhecido');
  END IF;
  
  -- Notificar admins
  PERFORM public.notify_admins(
    'Novo Testemunho',
    format('Novo testemunho recebido de %s: %s', v_display_nome, NEW.titulo),
    'novo_testemunho',
    CASE WHEN NEW.anonimo = true THEN NULL ELSE (SELECT user_id FROM public.profiles WHERE id = NEW.autor_id) END,
    jsonb_build_object(
      'autor_nome', v_display_nome,
      'titulo', NEW.titulo,
      'categoria', NEW.categoria,
      'testemunho_id', NEW.id,
      'anonimo', NEW.anonimo
    )
  );
  
  RETURN NEW;
END;
$function$;

-- Criar função para notificar novo pedido de oração com suporte a anonimização
CREATE OR REPLACE FUNCTION public.notify_new_pedido_oracao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_solicitante_nome TEXT;
  v_display_nome TEXT;
BEGIN
  -- Determinar nome do solicitante
  IF NEW.pessoa_id IS NOT NULL THEN
    SELECT nome INTO v_solicitante_nome
    FROM public.profiles
    WHERE id = NEW.pessoa_id;
  ELSIF NEW.nome_solicitante IS NOT NULL THEN
    v_solicitante_nome := NEW.nome_solicitante;
  END IF;
  
  -- Se for anônimo, usar "Anônimo" ao invés do nome real
  IF NEW.anonimo = true THEN
    v_display_nome := 'Anônimo';
  ELSE
    v_display_nome := COALESCE(v_solicitante_nome, 'solicitante desconhecido');
  END IF;
  
  -- Notificar admins
  PERFORM public.notify_admins(
    'Novo Pedido de Oração',
    format('Novo pedido de oração recebido de %s (Tipo: %s)', v_display_nome, NEW.tipo),
    'novo_pedido_oracao',
    CASE WHEN NEW.anonimo = true THEN NULL ELSE (SELECT user_id FROM public.profiles WHERE id = NEW.pessoa_id) END,
    jsonb_build_object(
      'solicitante_nome', v_display_nome,
      'tipo', NEW.tipo,
      'pedido_id', NEW.id,
      'anonimo', NEW.anonimo
    )
  );
  
  RETURN NEW;
END;
$function$;

-- Criar trigger para notificar novo pedido de oração
DROP TRIGGER IF EXISTS trigger_notify_new_pedido_oracao ON public.pedidos_oracao;
CREATE TRIGGER trigger_notify_new_pedido_oracao
  AFTER INSERT ON public.pedidos_oracao
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_pedido_oracao();
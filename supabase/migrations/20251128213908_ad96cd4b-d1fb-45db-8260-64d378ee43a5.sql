-- Criar função de notificação para novos testemunhos
CREATE OR REPLACE FUNCTION public.notify_new_testemunho()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_autor_nome TEXT;
BEGIN
  -- Buscar nome do autor
  SELECT nome INTO v_autor_nome
  FROM public.profiles
  WHERE id = NEW.autor_id;
  
  -- Notificar admins
  PERFORM public.notify_admins(
    'Novo Testemunho',
    format('Novo testemunho recebido de %s: %s', COALESCE(v_autor_nome, 'autor desconhecido'), NEW.titulo),
    'novo_testemunho',
    (SELECT user_id FROM public.profiles WHERE id = NEW.autor_id),
    jsonb_build_object(
      'autor_nome', v_autor_nome,
      'titulo', NEW.titulo,
      'categoria', NEW.categoria,
      'testemunho_id', NEW.id
    )
  );
  
  RETURN NEW;
END;
$$;

-- Criar trigger para notificar quando novo testemunho é criado
CREATE TRIGGER trigger_notify_new_testemunho
  AFTER INSERT ON public.testemunhos
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_testemunho();
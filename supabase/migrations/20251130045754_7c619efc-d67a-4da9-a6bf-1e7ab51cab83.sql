-- =====================================================
-- FIX: Function Search Path Mutable
-- =====================================================
-- Adding SET search_path = public to all functions that don't have it
-- This prevents security issues from search_path manipulation

-- Fix: alocar_pedido_balanceado
CREATE OR REPLACE FUNCTION public.alocar_pedido_balanceado(p_pedido_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_intercessor_id UUID;
BEGIN
  SELECT i.id INTO v_intercessor_id
  FROM public.intercessores i
  LEFT JOIN (
    SELECT intercessor_id, COUNT(*) as total_pedidos
    FROM public.pedidos_oracao
    WHERE status IN ('pendente', 'em_oracao')
    GROUP BY intercessor_id
  ) p ON i.id = p.intercessor_id
  WHERE i.ativo = true
    AND (p.total_pedidos IS NULL OR p.total_pedidos < i.max_pedidos)
  ORDER BY COALESCE(p.total_pedidos, 0) ASC, i.created_at ASC
  LIMIT 1;
  
  IF v_intercessor_id IS NOT NULL THEN
    UPDATE public.pedidos_oracao
    SET 
      intercessor_id = v_intercessor_id,
      status = 'em_oracao',
      data_alocacao = now()
    WHERE id = p_pedido_id;
  END IF;
  
  RETURN v_intercessor_id;
END;
$function$;

-- Fix: log_edge_function_execution
CREATE OR REPLACE FUNCTION public.log_edge_function_execution(p_function_name text, p_status text, p_details text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.edge_function_config
  SET 
    last_execution = now(),
    last_execution_status = p_status,
    execution_count = execution_count + 1,
    updated_at = now()
  WHERE function_name = p_function_name;
END;
$function$;

-- Fix: buscar_pessoa_por_contato
CREATE OR REPLACE FUNCTION public.buscar_pessoa_por_contato(p_nome text DEFAULT NULL, p_email text DEFAULT NULL, p_telefone text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_pessoa_id uuid;
BEGIN
  IF p_email IS NOT NULL THEN
    SELECT id INTO v_pessoa_id
    FROM public.profiles
    WHERE LOWER(email) = LOWER(p_email)
    LIMIT 1;
    
    IF v_pessoa_id IS NOT NULL THEN
      RETURN v_pessoa_id;
    END IF;
  END IF;
  
  IF p_telefone IS NOT NULL THEN
    SELECT id INTO v_pessoa_id
    FROM public.profiles
    WHERE REGEXP_REPLACE(telefone, '[^0-9]', '', 'g') = REGEXP_REPLACE(p_telefone, '[^0-9]', '', 'g')
    LIMIT 1;
    
    IF v_pessoa_id IS NOT NULL THEN
      RETURN v_pessoa_id;
    END IF;
  END IF;
  
  IF p_nome IS NOT NULL THEN
    SELECT id INTO v_pessoa_id
    FROM public.profiles
    WHERE LOWER(nome) = LOWER(p_nome)
    LIMIT 1;
    
    IF v_pessoa_id IS NOT NULL THEN
      RETURN v_pessoa_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Fix: log_profile_access (already has search_path but ensuring it's correct)
CREATE OR REPLACE FUNCTION public.log_profile_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN NEW;
END;
$function$;

-- Fix: notify_new_pedido_oracao
CREATE OR REPLACE FUNCTION public.notify_new_pedido_oracao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_solicitante_nome TEXT;
  v_display_nome TEXT;
BEGIN
  IF NEW.pessoa_id IS NOT NULL THEN
    SELECT nome INTO v_solicitante_nome
    FROM public.profiles
    WHERE id = NEW.pessoa_id;
  ELSIF NEW.nome_solicitante IS NOT NULL THEN
    v_solicitante_nome := NEW.nome_solicitante;
  END IF;
  
  IF NEW.anonimo = true THEN
    v_display_nome := 'Anônimo';
  ELSE
    v_display_nome := COALESCE(v_solicitante_nome, 'solicitante desconhecido');
  END IF;
  
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

-- Fix: notify_new_testemunho
CREATE OR REPLACE FUNCTION public.notify_new_testemunho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_autor_nome TEXT;
  v_display_nome TEXT;
BEGIN
  SELECT nome INTO v_autor_nome
  FROM public.profiles
  WHERE id = NEW.autor_id;
  
  IF NEW.anonimo = true THEN
    v_display_nome := 'Anônimo';
  ELSE
    v_display_nome := COALESCE(v_autor_nome, 'autor desconhecido');
  END IF;
  
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

-- Fix: atualizar_saldo_conta
CREATE OR REPLACE FUNCTION public.atualizar_saldo_conta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual + NEW.valor
      WHERE id = NEW.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual - NEW.valor
      WHERE id = NEW.conta_id;
    END IF;
  ELSIF OLD.status = 'pago' AND NEW.status != 'pago' THEN
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual - OLD.valor
      WHERE id = OLD.conta_id;
    ELSIF NEW.tipo = 'saida' THEN
      UPDATE public.contas 
      SET saldo_atual = saldo_atual + OLD.valor
      WHERE id = OLD.conta_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix: notify_new_visitor
CREATE OR REPLACE FUNCTION public.notify_new_visitor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
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
$function$;

-- Fix: notify_status_promotion
CREATE OR REPLACE FUNCTION public.notify_status_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_message TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'frequentador' THEN
      v_message := format('%s foi promovido a Frequentador', NEW.nome);
    ELSIF NEW.status = 'membro' THEN
      v_message := format('%s foi promovido a Membro', NEW.nome);
    ELSE
      v_message := format('Status de %s foi alterado para %s', NEW.nome, NEW.status);
    END IF;
    
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
$function$;

-- Fix: notify_role_assignment
CREATE OR REPLACE FUNCTION public.notify_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_name TEXT;
BEGIN
  SELECT nome INTO v_user_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;
  
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
$function$;

-- Fix: notify_role_removal
CREATE OR REPLACE FUNCTION public.notify_role_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_name TEXT;
BEGIN
  SELECT nome INTO v_user_name
  FROM public.profiles
  WHERE user_id = OLD.user_id;
  
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
$function$;
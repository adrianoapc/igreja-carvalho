CREATE OR REPLACE FUNCTION public.trigger_notify_atendimento_pastoral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  edge_function_url TEXT;
  service_key TEXT;
BEGIN
  -- Só dispara para gravidade ALTA ou CRITICA
  IF NEW.gravidade IN ('ALTA', 'CRITICA') THEN
    -- URL da edge function
    edge_function_url := 'https://mcomwaelbwvyotvudnzt.supabase.co/functions/v1/disparar-alerta';

    -- Buscar service role key das configurações (se disponível)
    service_key := current_setting('supabase.service_role_key', true);

    -- Fazer requisição HTTP para a edge function
    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'atendimentos_pastorais',
        'schema', 'public',
        'record', jsonb_build_object(
          'id', NEW.id,
          'pessoa_id', NEW.pessoa_id,
          'visitante_id', NEW.visitante_id,
          'pastor_responsavel_id', NEW.pastor_responsavel_id,
          'gravidade', NEW.gravidade,
          'origem', NEW.origem,
          'conteudo_original', NEW.conteudo_original,
          'motivo_resumo', NEW.motivo_resumo,
          'status', NEW.status,
          'created_at', NEW.created_at
        )
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;
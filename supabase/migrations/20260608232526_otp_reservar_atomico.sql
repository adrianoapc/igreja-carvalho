-- Função atômica para check de rate-limit + invalidação de OTPs antigos + inserção.
-- Usa pg_try_advisory_xact_lock sobre o hashtext do telefone para serializar
-- requisições concorrentes para o mesmo número de destino, eliminando a race
-- condition TOCTOU do fluxo anterior (check em app + insert separados).
--
-- Retorna:
--   'ok'          + otp_id se o slot foi reservado com sucesso
--   'rate_limited' se o número já atingiu o limite na janela
--   'lock_timeout' se outro request do mesmo número ainda está em andamento

CREATE OR REPLACE FUNCTION public.reservar_otp_whatsapp(
  p_telefone    TEXT,
  p_codigo_hash TEXT,
  p_expira_em   TIMESTAMPTZ,
  p_igreja_id   UUID,
  p_profile_id  UUID,
  p_rate_max    INT     DEFAULT 3,
  p_janela_min  INT     DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock_key   BIGINT;
  v_got_lock   BOOLEAN;
  v_recentes   INT;
  v_otp_id     UUID;
BEGIN
  -- Chave de lock determinística por número de destino (hashtext é estável dentro da instância)
  v_lock_key := hashtext(p_telefone)::BIGINT;

  -- Tenta adquirir advisory lock de transação (liberado automaticamente no commit/rollback)
  v_got_lock := pg_try_advisory_xact_lock(v_lock_key);

  IF NOT v_got_lock THEN
    RETURN jsonb_build_object('status', 'lock_timeout');
  END IF;

  -- Conta OTPs gerados na janela de tempo (contagem inclui todos os estados, não só ativos,
  -- para evitar burlar o limite invalidando os próprios registros)
  SELECT COUNT(*) INTO v_recentes
  FROM public.otp_verificacao
  WHERE telefone    = p_telefone
    AND tipo        = 'whatsapp'
    AND created_at >= now() - (p_janela_min || ' minutes')::interval;

  IF v_recentes >= p_rate_max THEN
    RETURN jsonb_build_object('status', 'rate_limited', 'recentes', v_recentes);
  END IF;

  -- Invalida OTPs anteriores ainda ativos do mesmo número
  UPDATE public.otp_verificacao
  SET usado = true
  WHERE telefone = p_telefone
    AND tipo     = 'whatsapp'
    AND usado    = false;

  -- Insere o novo OTP dentro do mesmo lock (atômico com as operações acima)
  INSERT INTO public.otp_verificacao (
    telefone, codigo, codigo_hash, tipo,
    expira_em, usado, tentativas, igreja_id, profile_id
  )
  VALUES (
    p_telefone, 'HASHED', p_codigo_hash, 'whatsapp',
    p_expira_em, false, 0, p_igreja_id, p_profile_id
  )
  RETURNING id INTO v_otp_id;

  RETURN jsonb_build_object('status', 'ok', 'otp_id', v_otp_id);
END;
$$;

-- Garante que apenas service_role pode chamar esta função
REVOKE ALL ON FUNCTION public.reservar_otp_whatsapp FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reservar_otp_whatsapp TO service_role;

-- ============================================================================
-- Fix — fin_resolver_contexto bloqueava super_admin puro (ADR-029)
--
-- O gate JWT de fin_resolver_contexto (F1, migration 20260710120000) exigia
-- has_role(admin) OR has_role(tesoureiro). has_role('admin') já cobre
-- admin_igreja/admin_filial (definição de has_role, migration 20260105120000),
-- mas NÃO cobre super_admin — em todo o resto do código, super_admin é
-- checado à parte (ex.: 20260104191000, 20260105153404, 20260115174003).
--
-- Isso passou despercebido enquanto nenhuma RPC fin_* era o único caminho de
-- escrita; a F5 migrou a importação de extratos (antes INSERT direto + RLS,
-- que checava super_admin explicitamente) para fin_ingerir_extratos, que
-- passa por este gate — bloqueando um usuário super_admin puro (sem também
-- ter admin/admin_igreja/admin_filial/tesoureiro) de importar/desfazer.
--
-- CREATE OR REPLACE do corpo original (F1), só ampliando o gate.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fin_resolver_contexto(
  p_contexto jsonb DEFAULT NULL,
  p_flag_bot text DEFAULT NULL   -- coluna de profiles exigida p/ canal bot
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_service boolean := COALESCE(auth.jwt() ->> 'role', '') = 'service_role' AND auth.uid() IS NULL;
  v_igreja uuid;
  v_filial uuid;
  v_profile record;
  v_canal text;
  v_flag_ok boolean;
BEGIN
  IF v_uid IS NOT NULL THEN
    -- Canal frontend: tenant derivado do JWT; permissão de tesouraria.
    -- super_admin adicionado explicitamente (has_role('admin') não o cobre).
    IF NOT (has_role(v_uid, 'admin'::app_role) OR has_role(v_uid, 'tesoureiro'::app_role)
            OR has_role(v_uid, 'super_admin'::app_role)) THEN
      RAISE EXCEPTION 'FIN_SEM_PERMISSAO: requer papel admin ou tesoureiro';
    END IF;

    v_igreja := public.get_current_user_igreja_id();
    IF v_igreja IS NULL THEN
      RAISE EXCEPTION 'FIN_TENANT: igreja não resolvida a partir do JWT';
    END IF;

    -- Tenant explícito no p_contexto é validado contra o JWT (nunca confiado).
    IF p_contexto ? 'igreja_id'
       AND (p_contexto ->> 'igreja_id')::uuid IS DISTINCT FROM v_igreja
       AND NOT has_role(v_uid, 'admin'::app_role) THEN
      RAISE EXCEPTION 'FIN_TENANT: igreja_id do contexto diverge do JWT';
    END IF;

    IF p_contexto ? 'filial_id' AND p_contexto ->> 'filial_id' IS NOT NULL THEN
      v_filial := (p_contexto ->> 'filial_id')::uuid;
      IF NOT public.has_filial_access(v_igreja, v_filial) THEN
        RAISE EXCEPTION 'FIN_TENANT: sem acesso à filial informada';
      END IF;
    ELSE
      v_filial := public.get_current_user_filial_id();
    END IF;

    SELECT id INTO v_profile FROM public.profiles WHERE user_id = v_uid LIMIT 1;

    RETURN jsonb_build_object(
      'igreja_id', v_igreja,
      'filial_id', v_filial,
      'ator_profile_id', v_profile.id,
      'ator_user_id', v_uid,
      'canal', COALESCE(p_contexto ->> 'canal', 'web')
    );
  END IF;

  IF v_is_service THEN
    -- Canal service role (bot/edges): p_contexto obrigatório e validado.
    IF p_contexto IS NULL
       OR NOT (p_contexto ? 'igreja_id')
       OR NOT (p_contexto ? 'ator_profile_id')
       OR NOT (p_contexto ? 'canal') THEN
      RAISE EXCEPTION 'FIN_CONTEXTO: service role exige p_contexto {igreja_id, ator_profile_id, canal}';
    END IF;

    v_igreja := (p_contexto ->> 'igreja_id')::uuid;
    v_filial := NULLIF(p_contexto ->> 'filial_id', '')::uuid;
    v_canal  := p_contexto ->> 'canal';

    SELECT id, user_id, igreja_id, autorizado_bot_financeiro,
           autorizado_lancar_despesas, autorizado_lancar_depositos,
           autorizado_lancar_reembolsos
      INTO v_profile
      FROM public.profiles
     WHERE id = (p_contexto ->> 'ator_profile_id')::uuid
     LIMIT 1;

    IF v_profile.id IS NULL OR v_profile.igreja_id IS DISTINCT FROM v_igreja THEN
      RAISE EXCEPTION 'FIN_CONTEXTO: ator não pertence ao tenant informado';
    END IF;

    IF v_canal = 'bot' THEN
      IF NOT COALESCE(v_profile.autorizado_bot_financeiro, false) THEN
        RAISE EXCEPTION 'FIN_BOT: ator não autorizado no bot financeiro';
      END IF;
      IF p_flag_bot IS NOT NULL THEN
        v_flag_ok := CASE p_flag_bot
          WHEN 'autorizado_lancar_despesas'  THEN COALESCE(v_profile.autorizado_lancar_despesas, false)
          WHEN 'autorizado_lancar_depositos' THEN COALESCE(v_profile.autorizado_lancar_depositos, false)
          WHEN 'autorizado_lancar_reembolsos' THEN COALESCE(v_profile.autorizado_lancar_reembolsos, false)
          ELSE false
        END;
        IF NOT v_flag_ok THEN
          RAISE EXCEPTION 'FIN_BOT: ator sem a permissão % no bot financeiro', p_flag_bot;
        END IF;
      END IF;
    END IF;

    RETURN jsonb_build_object(
      'igreja_id', v_igreja,
      'filial_id', v_filial,
      'ator_profile_id', v_profile.id,
      'ator_user_id', v_profile.user_id,
      'canal', v_canal
    );
  END IF;

  RAISE EXCEPTION 'FIN_AUTH: chamada sem JWT de usuário nem service role';
END;
$$;

COMMENT ON FUNCTION public.fin_resolver_contexto IS
  'Resolve tenant/ator/canal para as RPCs fin_* (ADR-029 §convenção 4). JWT: tenant do token + papel admin|tesoureiro|super_admin. Service role: p_contexto validado; canal bot checa flags de profiles.';

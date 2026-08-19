-- URGENTE — achado durante auditoria das ~161 funções não-fin_* flagadas
-- por anon_security_definer_function_executable (mesma investigação das
-- PRs #119-#121).
--
-- criar_usuario_membro e resetar_senha_usuario_membro são SECURITY
-- DEFINER, chamam auth.create_user()/auth.update_user_by_id() e NÃO TÊM
-- NENHUMA verificação de autorização interna (sem has_role, sem
-- auth.uid(), sem tenant check) — só validam que o p_profile_id alvo
-- existe. Qualquer authenticated (mesmo membro comum) podia criar login
-- com senha à escolha pra qualquer perfil sem conta, ou resetar a senha
-- de QUALQUER conta já existente (inclusive admin/pastor/tesoureiro).
-- Pior: as duas tinham GRANT EXECUTE ... TO anon ao vivo em produção —
-- drift, a migration original (20260114165000) só concedia pra
-- authenticated — então era explorável até sem login.
--
-- Confirmado que nenhum código do app (frontend nem edge functions)
-- chama essas RPCs hoje — criar-usuario/manage-users/
-- provisionar-admin-igreja usam a Admin API do Supabase direto via
-- service_role, sem passar por aqui. Travado pra service_role only em
-- vez de apagado — reversível, sem decidir agora se a função morre de
-- vez.

REVOKE ALL ON FUNCTION public.criar_usuario_membro(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resetar_senha_usuario_membro(uuid, text)
  FROM PUBLIC, anon, authenticated;

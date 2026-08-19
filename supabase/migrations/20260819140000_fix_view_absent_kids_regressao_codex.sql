-- @codex review (PR #118, achado P2): a migration 20260818124000 trocou
-- view_absent_kids para security_invoker=true junto com outras 8 views,
-- mas ela faz JOIN direto em `profiles` (nome/data_nascimento/alergias/
-- telefone de CRIANÇA) — e a RLS de `profiles` só libera SELECT pra
-- admin, tecnico (mesma igreja), o próprio usuário ou membros da mesma
-- família, NÃO pra lider/secretario. São exatamente os papéis que
-- gerenciam o módulo Kids (kids_checkins, corrigido nesta mesma PR) e
-- usam KidsAbsentAlert.tsx (tela Kids, em uso hoje). Resultado real:
-- lider/secretario abrindo essa tela passa a ver 0 linhas sempre —
-- regressão confirmada lendo a policy de profiles e o componente.
--
-- Reavaliado: nem security_invoker puro nem o SECURITY DEFINER original
-- servem aqui. `profiles` tem dado real (nome/telefone/alergia de
-- criança de fato — diferente das outras 5 views desta leva, cujas
-- tabelas-base estão vazias), então o DEFINER original também vazava:
-- qualquer authenticated de QUALQUER igreja lia isso via a view, já que
-- ela ignorava a RLS de profiles inteiramente (confirmado: hoje
-- presencas_aula tem 0 linhas em produção, então não houve vazamento
-- ativo ainda — mas o desenho era o mesmo bug estrutural das demais 20+
-- correções desta PR). A view precisa da PRÓPRIA checagem de
-- autorização (role de staff Kids + tenant), independente da RLS da
-- tabela profiles — mesmo padrão já usado pra eventos_publicos (mantida
-- definer nesta mesma PR, com justificativa análoga).
--
-- Nota de drift: o SELECT abaixo replica `pg_get_viewdef` da view ao
-- vivo (checado antes de escrever esta migration), não a migration de
-- criação (20251204014241) — a versão em produção já tinha ganho a
-- coluna `igreja_id` fora de qualquer migration rastreada neste repo
-- (mesmo tipo de drift documentado em AGENTS.md). `CREATE OR REPLACE
-- VIEW` não deixa remover/reordenar colunas existentes, então a
-- omissão teria quebrado o deploy.

ALTER VIEW public.view_absent_kids SET (security_invoker = false);

CREATE OR REPLACE VIEW public.view_absent_kids AS
SELECT
  p.id as child_id,
  p.nome as full_name,
  p.data_nascimento,
  p.alergias,
  p.telefone as parent_phone,
  (
    SELECT pr.nome
    FROM public.profiles pr
    WHERE pr.familia_id = p.familia_id
      AND pr.responsavel_legal = true
    LIMIT 1
  ) as parent_name,
  MAX(pa.checkin_at) as last_visit,
  EXTRACT(DAY FROM (NOW() - MAX(pa.checkin_at))) as days_absent,
  p.igreja_id
FROM public.profiles p
JOIN public.presencas_aula pa ON p.id = pa.aluno_id
WHERE
  p.data_nascimento IS NOT NULL
  AND DATE_PART('year', AGE(p.data_nascimento)) < 13
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
    OR has_role(auth.uid(), 'secretario'::app_role)
  )
  AND has_filial_access(p.igreja_id, p.filial_id)
GROUP BY p.id, p.nome, p.data_nascimento, p.alergias, p.telefone, p.familia_id, p.igreja_id, p.filial_id
HAVING
  MAX(pa.checkin_at) < NOW() - INTERVAL '14 days'
  AND MAX(pa.checkin_at) > NOW() - INTERVAL '60 days';

ALTER VIEW public.view_absent_kids SET (security_invoker = false);

-- Fecha o mesmo padrão de "Auth pode ver presencas aula" (fixado em
-- 20260819100000) em salas e liturgia_templates: uma migration de
-- 2026-01-04 (20260104060521/20260104060625/20260104060740) adicionou
-- policies com has_filial_access só que sob um NOME DIFERENTE, em vez
-- de substituir a policy original — deixando a policy antiga (USING
-- true, sem checar tenant) órfã. Como policies do mesmo comando são
-- combinadas com OR, a antiga ainda vale e anula o has_filial_access da
-- nova: qualquer authenticated (de qualquer igreja) lê salas e
-- templates de liturgia de QUALQUER outra igreja hoje.
--
-- Confirmado ao vivo (pg_policies) que a policy nova já cobre o mesmo
-- comando (SELECT) para authenticated com has_filial_access — dropar a
-- órfã não tira acesso legítimo de ninguém, só fecha o vazamento.
--
-- `aulas` já tinha sido corrigida corretamente na mesma leva de
-- 2026-01-04 (a policy antiga foi substituída in-place, sem órfã) —
-- confirmado ao vivo, nada a fazer lá.
--
-- midias/midia_tags/liturgia_recursos TÊM o mesmo padrão de policy
-- órfã, mas NÃO são tocadas aqui: elas atendem usuário anônimo de
-- propósito (rota pública /telao/liturgia/:id, o telão da igreja
-- durante o culto, fora de qualquer AuthGate) — aplicar
-- has_filial_access ali quebraria esse recurso, já que anon não tem
-- claim de igreja_id/filial_id no JWT. Precisa de um desenho de fix
-- diferente (não é um simples DROP), fora do escopo deste commit.

DROP POLICY IF EXISTS "Auth pode ler templates liturgia" ON public.liturgia_templates;
DROP POLICY IF EXISTS "Auth pode ver salas" ON public.salas;

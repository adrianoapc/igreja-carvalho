-- Fecha o mesmo padrão de policy órfã (sem has_filial_access) achado em
-- 20260819110000, agora nas demais tabelas com o problema: quando uma
-- migration de 2026-01-04 (20260104060521/20260104060625/20260104060740)
-- retrofitou has_filial_access, ela recriou várias policies sob nome
-- NOVO em vez de substituir a antiga — a antiga ficou órfã e, sendo
-- OR'd com a nova (mesmo comando), continua liberando acesso
-- cross-tenant. Cobre formas_pagamento e solicitacoes_reembolso
-- (financeiro) e kids_checkins (dado de criança) — as de maior
-- severidade — mais funcoes_igreja, intercessores, liturgias,
-- membro_funcoes, projetos, sentimentos_membros, tags_midias, tarefas,
-- testemunhos, times.
--
-- Duas famílias de fix:
--   (a) DROP puro: a policy nova já cobre o MESMO conjunto de papéis
--       que a antiga — apagar a órfã não tira acesso de ninguém.
--   (b) DROP + CREATE (merge): a policy "corrigida" tinha estreitado o
--       conjunto de papéis por engano (ex.: kids_checkins perdeu
--       'secretario', projetos/tarefas perderam 'lider') — em vez de só
--       apagar a antiga (que perderia esse papel), funde os dois
--       conjuntos de papéis num único policy já com has_filial_access.
--
-- Achados extras durante a varredura: policies de INSERT self-scoped
-- (autor_id/pessoa_id/solicitante_id = próprio perfil) SEM
-- has_filial_access permitiam ao próprio usuário forjar um igreja_id
-- arbitrário na criação de sentimentos_membros/solicitacoes_reembolso/
-- testemunhos, já que existia uma policy irmã idêntica MAS com
-- has_filial_access — fechado dropando a órfã sem o check (não perde
-- nada: a policy irmã já cobre a mesma auto-inserção com filial).
--
-- NÃO tocados (fora de escopo, decisão de produto):
--   - testemunhos: "Todos podem ver testemunhos públicos publicados"
--     (status=publico AND publicar=true, sem filial, sem role) parece
--     um "mural público" cross-tenant intencional (flag `publicar`
--     opt-in) — mesma categoria do caso midias/telão de 20260819110000,
--     não é um DROP mecânico seguro.

-- === formas_pagamento (financeiro) ===
DROP POLICY IF EXISTS "Admins e tesoureiros podem gerenciar formas de pagamento" ON public.formas_pagamento;

-- === funcoes_igreja ===
DROP POLICY IF EXISTS "Admins podem deletar funções" ON public.funcoes_igreja;
DROP POLICY IF EXISTS "Admins podem criar funções" ON public.funcoes_igreja;
DROP POLICY IF EXISTS "Admins podem atualizar funções" ON public.funcoes_igreja;
DROP POLICY IF EXISTS "Todos podem ver funções ativas" ON public.funcoes_igreja;

-- === intercessores ===
DROP POLICY IF EXISTS "Admins podem deletar intercessores" ON public.intercessores;
DROP POLICY IF EXISTS "Admins podem criar intercessores" ON public.intercessores;
DROP POLICY IF EXISTS "Admins podem atualizar intercessores" ON public.intercessores;
DROP POLICY IF EXISTS "Admins podem ver todos os intercessores" ON public.intercessores;

-- === kids_checkins (dado de criança — merge para preservar 'secretario') ===
DROP POLICY IF EXISTS "Pais veem checkins dos filhos" ON public.kids_checkins;
DROP POLICY IF EXISTS "Lideres gerenciam kids checkins" ON public.kids_checkins;
DROP POLICY IF EXISTS "Staff pode gerenciar checkins kids" ON public.kids_checkins;
CREATE POLICY "Staff pode gerenciar checkins kids" ON public.kids_checkins
  FOR ALL USING (
    (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'lider'::app_role) OR
      has_role(auth.uid(), 'secretario'::app_role)
    )
    AND has_filial_access(igreja_id, filial_id)
  );

-- === liturgias ===
DROP POLICY IF EXISTS "Admin gerencia liturgias" ON public.liturgias;

-- === membro_funcoes ===
DROP POLICY IF EXISTS "Admins podem deletar atribuições" ON public.membro_funcoes;
DROP POLICY IF EXISTS "Admins podem criar atribuições" ON public.membro_funcoes;
DROP POLICY IF EXISTS "Admins podem atualizar atribuições" ON public.membro_funcoes;
DROP POLICY IF EXISTS "Admins podem ver todas as atribuições" ON public.membro_funcoes;

-- === projetos (merge para preservar 'lider') ===
DROP POLICY IF EXISTS "Secretarios visualizam projetos" ON public.projetos;
DROP POLICY IF EXISTS "Admins e lideres gerenciam projetos" ON public.projetos;
DROP POLICY IF EXISTS "Admins podem gerenciar projetos" ON public.projetos;
CREATE POLICY "Admins podem gerenciar projetos" ON public.projetos
  FOR ALL USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );

-- === sentimentos_membros ===
DROP POLICY IF EXISTS "Admins podem ver todos os sentimentos" ON public.sentimentos_membros;
DROP POLICY IF EXISTS "Membros podem criar seus sentimentos" ON public.sentimentos_membros;

-- === solicitacoes_reembolso (financeiro) ===
DROP POLICY IF EXISTS "Usuários podem ver suas próprias solicitações" ON public.solicitacoes_reembolso;
DROP POLICY IF EXISTS "Usuários podem criar suas solicitações" ON public.solicitacoes_reembolso;
DROP POLICY IF EXISTS "Usuários podem editar suas solicitações" ON public.solicitacoes_reembolso;
CREATE POLICY "Usuários podem editar suas solicitações" ON public.solicitacoes_reembolso
  FOR UPDATE USING (
    solicitante_id = (SELECT profiles.id FROM profiles WHERE profiles.user_id = auth.uid() LIMIT 1)
  );

-- === tags_midias ===
DROP POLICY IF EXISTS "Admins podem gerenciar tags de mídias" ON public.tags_midias;
DROP POLICY IF EXISTS "Todos podem ver tags ativas" ON public.tags_midias;

-- === tarefas (merge para preservar 'lider'; secretario continua vendo tudo do tenant) ===
DROP POLICY IF EXISTS "Admins e lideres gerenciam tarefas" ON public.tarefas;
DROP POLICY IF EXISTS "Admins podem gerenciar tarefas" ON public.tarefas;
CREATE POLICY "Admins podem gerenciar tarefas" ON public.tarefas
  FOR ALL USING (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'lider'::app_role))
    AND has_filial_access(igreja_id, filial_id)
  );
DROP POLICY IF EXISTS "Secretarios visualizam tarefas" ON public.tarefas;
CREATE POLICY "Secretarios visualizam tarefas" ON public.tarefas
  FOR SELECT USING (
    has_role(auth.uid(), 'secretario'::app_role)
    AND has_filial_access(igreja_id, filial_id)
  );

-- === testemunhos ===
DROP POLICY IF EXISTS "Admins podem deletar testemunhos" ON public.testemunhos;
DROP POLICY IF EXISTS "Admins podem atualizar qualquer testemunho" ON public.testemunhos;
DROP POLICY IF EXISTS "Admins podem ver todos os testemunhos" ON public.testemunhos;
DROP POLICY IF EXISTS "Membros podem criar testemunhos" ON public.testemunhos;

-- === times ===
DROP POLICY IF EXISTS "Admin gerencia times" ON public.times;
DROP POLICY IF EXISTS "Membros visualizam times ativos" ON public.times;

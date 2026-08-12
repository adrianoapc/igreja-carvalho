-- ============================================================================
-- Resolve os 2 bloqueios documentados na C2-6 pra getnet_credito_disponivel
-- virar fonte durável de verdade — decisão explícita do usuário: fechar
-- isso mesmo sem consumidor ainda (a view/tabelas base ficam seguras pra
-- qualquer uso futuro, incluindo a eventual C2-8).
--
-- Achado, durante a pesquisa: `getnet_credito_disponivel` já tinha `GRANT
-- SELECT ... TO authenticated` — PostgREST expõe automaticamente QUALQUER
-- view/tabela com esse grant via API REST, então "sem consumidor no
-- frontend ainda" não significava "sem exposição real": qualquer
-- tesoureiro/admin da igreja já podia consultar a view direto
-- (`supabase.from('getnet_credito_disponivel')`) e ver `filial_id` sem
-- nenhuma checagem de `has_filial_access` — o gap já era live, não só
-- teórico.
--
-- ─── 1. Bloqueio has_filial_access — revoga acesso direto ──────────────────
-- Em vez de construir uma RPC wrapper agora (sem consumidor real ainda,
-- seria abstração prematura), fecha o acesso direto: só service_role
-- consulta a view a partir daqui. Qualquer consumidor futuro (C2-8 ou
-- outro) precisa de uma RPC SECURITY DEFINER nova com has_filial_access —
-- não tem outro jeito de ler os dados, o que evita reintroduzir o mesmo
-- gap por esquecimento.
REVOKE SELECT ON public.getnet_credito_disponivel FROM authenticated;

COMMENT ON VIEW public.getnet_credito_disponivel IS
  'Ciclo 2 C2-6: crédito Getnet disponível, direto de getnet_resumo (LQ)/getnet_financeiro_resumo (PG) — equivalente aditivo ao espelho hoje escrito em extratos_bancarios (origem getnet_sftp_txt/getnet_sftp_tipo5). Fonte por arquivo travada em getnet_arquivos.espelho_origem (allow-list explícita, LEFT JOIN — arquivo sem linha em getnet_arquivos cai no fallback tipo1, mesma regra do NULL). conta_id vem SEMPRE da coluna própria (congelada no import, FK pra contas, ON DELETE SET NULL) — nunca relida da config atual; NULL é um estado final (atribuição desconhecida), não recalculado a cada consulta. Puramente leitura; nenhum consumidor ainda. SELECT revogado de authenticated (bloqueios da C2-6 resolvidos nesta migration) — só service_role/superuser consulta direto; qualquer consumidor futuro precisa de RPC SECURITY DEFINER nova com has_filial_access (filial_id aqui NÃO é filtrado por RLS). security_invoker=true — herda RLS (só igreja_id) das tabelas base, mas isso não basta sozinho, daí o REVOKE.';

-- ─── 1b. Achado do @codex review (PR #97, P1) — revogar só a VIEW não bastava ──
-- A view é aditiva sobre getnet_resumo (LQ) e getnet_financeiro_resumo (PG) —
-- revogar SELECT dela não fecha nada se o MESMO dado (valor_bruto/líquido,
-- filial_id, por RV/operação) continua legível direto nas tabelas base.
-- Confirmado: as policies `getnet_resumo_select`/`getnet_fin_resumo_select`
-- (20260603221141/20260617000001) checam só `igreja_id` + role — ZERO
-- dimensão de filial, apesar de `getnet_resumo.filial_id` ser preenchido de
-- verdade no import (congelado de `integracao.filial_id`, ver getnet-sftp/
-- index.ts) e nunca ficar NULL a não ser que a própria integração seja
-- compartilhada (`integracoes_financeiras.filial_id IS NULL`, mesma regra do
-- guardrail A). Um tesoureiro restrito a uma filial (via JWT `filial_id` ou
-- `user_filial_access`) já podia — antes desta migration E depois do fix da
-- 1., já que a 1. só tocou a view — ler `getnet_resumo`/`getnet_financeiro_
-- resumo` direto via PostgREST e ver o crédito de TODAS as filiais da
-- igreja. Gap pré-existente (documentado desde 20260811110000/20260812120000
-- como fora de escopo pontual), mas é EXATAMENTE o mesmo dado que a view
-- expõe — fechar só a view e deixar a fonte primária aberta não resolve o
-- "bloqueio 1" de fato, só move a porta de entrada.
--
-- Fix: mesmo padrão já usado em dezenas de outras tabelas do repo
-- (`has_filial_access(igreja_id, filial_id)` direto na policy de SELECT) —
-- não é abstração nova. `getnet_resumo` tem `filial_id` própria; `getnet_
-- financeiro_resumo` não tem (só `igreja_id`) — deriva via EXISTS contra
-- `integracoes_financeiras.filial_id` (única fonte de filial pra ela,
-- mesmo caminho que as RPCs `fin_buscar_financeiro_participante_getnet`/
-- `fin_listar_ajustes_getnet` já usam internamente). Sem efeito colateral
-- conhecido: nenhum frontend lê estas 2 tabelas direto (só via RPC
-- `SECURITY DEFINER`, que não é afetada — roda como owner, ignora RLS/
-- GRANT do invocador); a única escrita é `service_role` (edge function
-- getnet-sftp), que também ignora RLS.
--
-- **Achado do próprio harness, testando a 1ª versão deste fix**: só
-- recriar a policy `_select` (`FOR SELECT`) não bastou — ambas as tabelas
-- já tinham uma policy `_modify` (`FOR ALL`) SEM checagem de filial, e o
-- Postgres faz OR entre TODAS as policies permissivas aplicáveis ao mesmo
-- comando. Como `FOR ALL` cobre `SELECT` também, a policy `_modify` (sem
-- filial) permitia o SELECT passar mesmo com a `_select` (com filial)
-- negando — a tabela continuava 100% legível entre filiais, só a policy
-- "errada" que decidia. Confirmado com fixture real (2 filiais, tesoureiro
-- restrito a uma via `request.jwt.claim.filial_id`): a 1ª versão retornava
-- as 2 filiais; só depois de adicionar `has_filial_access` também no
-- `USING` do `_modify` o isolamento passou a valer pra leitura.
--
-- **Achado do Cursor Bugbot (PR #97, 2ª rodada, Medium)**: `WITH CHECK`
-- do `_modify` continuava só com `igreja_id` — como `authenticated`
-- ainda tem GRANT de INSERT/UPDATE/DELETE nas 2 tabelas (pré-existente,
-- não introduzido aqui), a suposição "só service_role escreve" não é
-- garantida pelo GRANT em si, só pela ausência de qualquer caminho no
-- código hoje. `WITH CHECK` agora também exige `has_filial_access` —
-- sem efeito no único escritor real (`service_role`, que ignora RLS via
-- `rolbypassrls`), só fecha a porta pra um hipotético INSERT/UPDATE
-- cross-filial via `authenticated` que os GRANTs já permitiam.
--
-- **Achado do @codex (PR #97, 2ª rodada, P1) — NÃO corrigido nesta PR,
-- registrado como follow-up separado**: `has_filial_access` (definição
-- em `20260105153404`) tem um shortcut de "backwards compatibility" —
-- se `get_jwt_filial_id() IS NULL` (usuário sem filial primária no
-- perfil/JWT), a função retorna `true` pra QUALQUER `_filial_id`, ANTES
-- de consultar `user_filial_access` — um tesoureiro sem filial primária
-- mas com restrição EXPLÍCITA em `user_filial_access` (só filial A)
-- ainda vê filial B também, porque o shortcut nunca deixa o `EXISTS`
-- decidir. Confirmado que é explorável de verdade, não só teórico:
-- existe UI dedicada pra isso (`UserFilialAccessManager.tsx`), que
-- permite conceder `user_filial_access` a qualquer usuário da igreja
-- sem exigir `filial_id` preenchido no perfil. **NÃO é um bug
-- introduzido por esta PR** — é pré-existente na função compartilhada,
-- usada em DEZENAS de outras policies RLS no repo; corrigi-la aqui
-- expandiria o raio de impacto muito além do escopo desta PR (2
-- bloqueios pontuais da C2-6) pra qualquer tabela que já usa
-- `has_filial_access`, sem harness dedicado pra validar todos os
-- consumidores. Registrado como achado de segurança prioritário,
-- separado, pra auditoria dedicada — não pendência escondida (resposta
-- deixada na própria thread do @codex).
-- Escopo consciente: NÃO estende pra `getnet_arquivos`/`getnet_analitico`/
-- `getnet_ajustes` (mesmo gap, mas fora do que o @codex apontou nesta
-- rodada) — auditoria dedicada de todas as tabelas Getnet já está
-- registrada como follow-up separado, não pendência escondida.
DROP POLICY IF EXISTS "getnet_resumo_select" ON public.getnet_resumo;
CREATE POLICY "getnet_resumo_select" ON public.getnet_resumo
  FOR SELECT TO authenticated
  USING (
    igreja_id = public.get_current_user_igreja_id()
    AND public.has_filial_access(igreja_id, filial_id)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_igreja'::app_role)
      OR public.has_role(auth.uid(), 'tesoureiro'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

DROP POLICY IF EXISTS "getnet_resumo_modify" ON public.getnet_resumo;
CREATE POLICY "getnet_resumo_modify" ON public.getnet_resumo
  FOR ALL TO authenticated
  USING (
    igreja_id = public.get_current_user_igreja_id()
    AND public.has_filial_access(igreja_id, filial_id)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_igreja'::app_role)
      OR public.has_role(auth.uid(), 'tesoureiro'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    igreja_id = public.get_current_user_igreja_id()
    AND public.has_filial_access(igreja_id, filial_id)
  );

DROP POLICY IF EXISTS "getnet_fin_resumo_select" ON public.getnet_financeiro_resumo;
CREATE POLICY "getnet_fin_resumo_select" ON public.getnet_financeiro_resumo
  FOR SELECT TO authenticated
  USING (
    igreja_id = public.get_current_user_igreja_id()
    AND EXISTS (
      SELECT 1 FROM public.integracoes_financeiras i
      WHERE i.id = getnet_financeiro_resumo.integracao_id
        AND public.has_filial_access(i.igreja_id, i.filial_id)
    )
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_igreja'::app_role)
      OR public.has_role(auth.uid(), 'tesoureiro'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

DROP POLICY IF EXISTS "getnet_fin_resumo_modify" ON public.getnet_financeiro_resumo;
CREATE POLICY "getnet_fin_resumo_modify" ON public.getnet_financeiro_resumo
  FOR ALL TO authenticated
  USING (
    igreja_id = public.get_current_user_igreja_id()
    AND EXISTS (
      SELECT 1 FROM public.integracoes_financeiras i
      WHERE i.id = getnet_financeiro_resumo.integracao_id
        AND public.has_filial_access(i.igreja_id, i.filial_id)
    )
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_igreja'::app_role)
      OR public.has_role(auth.uid(), 'tesoureiro'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    igreja_id = public.get_current_user_igreja_id()
    AND EXISTS (
      SELECT 1 FROM public.integracoes_financeiras i
      WHERE i.id = integracao_id
        AND public.has_filial_access(i.igreja_id, i.filial_id)
    )
  );

-- ─── 2. Bloqueio ON DELETE CASCADE — vira RESTRICT nas tabelas de dado ─────
-- Escopo: só as 8 tabelas que carregam DADO (histórico de import +
-- vínculos de reconciliação confirmados). `integracoes_financeiras_
-- secrets` (credenciais, sem valor de dado — faz sentido sumir junto) e
-- `integracoes_execucoes_log` (log de execução, não histórico financeiro)
-- CONTINUAM com CASCADE — mudar essas duas não tem o mesmo motivo de
-- proteção e tornaria impossível limpar credenciais órfãs.
--
-- RESTRICT, não SET NULL: `integracao_id` é NOT NULL nas 8 tabelas — SET
-- NULL exigiria tirar essa constraint, e uma linha `getnet_resumo`/
-- `getnet_recebivel_lancamentos` sem saber de qual integração veio perde
-- sentido (não dá pra saber qual conta/config gerou aquele dado). RESTRICT
-- é a escolha certa quando o dado referenciado tem valor duradouro por si
-- só (guardrail J) — bloqueia o DELETE em vez de perder o vínculo
-- silenciosamente.
--
-- Confirmado antes desta migration: `getnet-sync-automatico` (cron diário)
-- já filtra `WHERE status = 'ativo'` — "Inativar" (toggle já existente em
-- IntegracoesCriarDialog.tsx, `status='inativo'`) já é uma alternativa
-- REAL e funcional ao hard delete, só não estava oferecida no momento da
-- exclusão. Consumidores atuais de getnet_recebivel_lancamentos.
-- extrato_bancario_id/getnet_antecipacao_lotes.extrato_bancario_id (Hop1,
-- fin_conferencia_totais_getnet, ledger) continuam funcionando
-- exatamente igual — RESTRICT só muda o que acontece quando alguém tenta
-- excluir a integração, não nenhuma leitura existente.
ALTER TABLE public.getnet_resumo
  DROP CONSTRAINT getnet_resumo_integracao_id_fkey,
  ADD CONSTRAINT getnet_resumo_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE public.getnet_analitico
  DROP CONSTRAINT getnet_analitico_integracao_id_fkey,
  ADD CONSTRAINT getnet_analitico_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE public.getnet_arquivos
  DROP CONSTRAINT getnet_arquivos_integracao_id_fkey,
  ADD CONSTRAINT getnet_arquivos_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE public.getnet_ajustes
  DROP CONSTRAINT getnet_ajustes_integracao_id_fkey,
  ADD CONSTRAINT getnet_ajustes_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE public.getnet_financeiro_resumo
  DROP CONSTRAINT getnet_financeiro_resumo_integracao_id_fkey,
  ADD CONSTRAINT getnet_financeiro_resumo_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE public.getnet_financeiro_detalhe
  DROP CONSTRAINT getnet_financeiro_detalhe_integracao_id_fkey,
  ADD CONSTRAINT getnet_financeiro_detalhe_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE public.getnet_recebivel_lancamentos
  DROP CONSTRAINT getnet_recebivel_lancamentos_integracao_id_fkey,
  ADD CONSTRAINT getnet_recebivel_lancamentos_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

ALTER TABLE public.getnet_antecipacao_lotes
  DROP CONSTRAINT getnet_antecipacao_lotes_integracao_id_fkey,
  ADD CONSTRAINT getnet_antecipacao_lotes_integracao_id_fkey
    FOREIGN KEY (integracao_id) REFERENCES public.integracoes_financeiras(id) ON DELETE RESTRICT;

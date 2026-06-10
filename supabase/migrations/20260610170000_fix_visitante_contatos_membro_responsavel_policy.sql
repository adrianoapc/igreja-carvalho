-- Corrige bug de copia-e-cola na migracao 20260105120000_add_filiais_and_filial_scope.sql:
-- as politicas "Membros responsaveis podem ver/atualizar seus contatos" foram
-- reescritas usando a coluna `responsavel_id` (que nao existe em
-- visitante_contatos - existe apenas em familias/tarefas/etc), em vez da
-- coluna correta `membro_responsavel_id`. Como a coluna referenciada nao
-- existe na tabela, o ALTER POLICY falha com "column responsavel_id does not
-- exist", deixando essas duas politicas com a definicao anterior (de
-- 20260103150000_add_igreja_id_multitenant.sql: `membro_responsavel_id =
-- auth.uid()` + filtro por igreja_id via JWT, sem has_filial_access).
--
-- Esta migracao reaplica a intencao original de 20260105120000: escopar por
-- filial usando has_filial_access, mantendo a coluna correta
-- membro_responsavel_id.

ALTER POLICY "Membros responsáveis podem ver seus contatos" ON public.visitante_contatos
  USING (
    membro_responsavel_id = auth.uid()
    AND has_filial_access(igreja_id, filial_id)
  );

ALTER POLICY "Membros responsáveis podem atualizar seus contatos" ON public.visitante_contatos
  USING (
    membro_responsavel_id = auth.uid()
    AND has_filial_access(igreja_id, filial_id)
  )
  WITH CHECK (
    membro_responsavel_id = auth.uid()
    AND has_filial_access(igreja_id, filial_id)
  );

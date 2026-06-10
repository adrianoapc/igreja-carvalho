-- Permite contatos agendados sem responsavel definido (membro_responsavel_id),
-- para que o cadastro publico (cadastro-publico, usado por
-- /cadastro/visitante, /cadastro/cafe-vp e recepcao/Visitante) possa agendar
-- o follow-up de quem marcou "deseja contato" mesmo sem um membro logado para
-- atribuir como responsavel. A atribuicao a um lider/departamento responsavel
-- fica para uma rotina de roteamento futura.

ALTER TABLE public.visitante_contatos
  ALTER COLUMN membro_responsavel_id DROP NOT NULL;

-- Staff da igreja (nao apenas admin global) precisa ver/gerenciar contatos
-- agendados da sua filial, incluindo os que ainda nao tem responsavel,
-- espelhando a politica adicionada para profile_contatos em
-- 20260609120000_fix_profile_contatos_rls.sql.

DROP POLICY IF EXISTS "Church staff podem ver contatos agendados da filial" ON public.visitante_contatos;
CREATE POLICY "Church staff podem ver contatos agendados da filial"
ON public.visitante_contatos FOR SELECT
USING (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin_igreja'::app_role)
    OR has_role(auth.uid(), 'pastor'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
    OR has_role(auth.uid(), 'secretario'::app_role)
    OR has_role(auth.uid(), 'tesoureiro'::app_role)
    OR has_role(auth.uid(), 'professor'::app_role)
  )
  AND has_filial_access(igreja_id, filial_id)
);

DROP POLICY IF EXISTS "Church staff podem gerenciar contatos agendados da filial" ON public.visitante_contatos;
CREATE POLICY "Church staff podem gerenciar contatos agendados da filial"
ON public.visitante_contatos FOR UPDATE
USING (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin_igreja'::app_role)
    OR has_role(auth.uid(), 'pastor'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
    OR has_role(auth.uid(), 'secretario'::app_role)
    OR has_role(auth.uid(), 'tesoureiro'::app_role)
    OR has_role(auth.uid(), 'professor'::app_role)
  )
  AND has_filial_access(igreja_id, filial_id)
)
WITH CHECK (
  (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'admin_igreja'::app_role)
    OR has_role(auth.uid(), 'pastor'::app_role)
    OR has_role(auth.uid(), 'lider'::app_role)
    OR has_role(auth.uid(), 'secretario'::app_role)
    OR has_role(auth.uid(), 'tesoureiro'::app_role)
    OR has_role(auth.uid(), 'professor'::app_role)
  )
  AND has_filial_access(igreja_id, filial_id)
);

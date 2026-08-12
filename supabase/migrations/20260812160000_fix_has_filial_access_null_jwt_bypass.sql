-- Fix: has_filial_access() ignorava user_filial_access (allowlist granular)
-- quando o usuário não tem filial primária no JWT/perfil.
--
-- Bug: o shortcut "get_jwt_filial_id() IS NULL" era avaliado ANTES do EXISTS
-- contra user_filial_access, então QUALQUER usuário sem filial primária
-- tinha acesso irrestrito a TODAS as filiais, mesmo com uma restrição
-- granular explícita (user_filial_access só pra filial A) configurada via
-- UserFilialAccessManager.tsx. Achado em revisão da PR #97 (2026-08-12).
--
-- Fix: o shortcut "sem filial primária = acesso total" só vale quando o
-- usuário NÃO tem NENHUMA row em user_filial_access (comportamento legado,
-- sem restrição granular configurada). Se existe qualquer row, ela decide
-- (allow/deny) por conta própria para a filial pedida.
CREATE OR REPLACE FUNCTION public.has_filial_access(_igreja_id UUID, _filial_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- COALESCE(..., false): as comparações abaixo (ex.: _filial_id =
  -- get_jwt_filial_id()) retornam SQL NULL, não false, quando um dos lados
  -- é NULL. Sem o COALESCE, a função podia retornar NULL, e dezenas de RPCs
  -- fazem "IF NOT public.has_filial_access(...) THEN RAISE EXCEPTION" — em
  -- PL/pgSQL, IF com condição NULL é tratado como false, então o RAISE
  -- EXCEPTION seria pulado e o acesso liberado por engano (o oposto do
  -- pretendido). Confirmado no harness: sem o COALESCE, o caso "sem filial
  -- primária + grant só pra outra filial" retornava NULL em vez de false.
  SELECT COALESCE(
    -- Admin global tem acesso total
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      -- Mesmo igreja_id ou igreja_id não definida no JWT (backwards compatibility)
      (_igreja_id = public.get_jwt_igreja_id() OR public.get_jwt_igreja_id() IS NULL)
      AND (
        -- Admin da igreja tem acesso total na igreja
        has_role(auth.uid(), 'admin_igreja'::app_role)
        OR (
          -- Filial compartilhada (sem dono) ou é a filial primária do JWT
          _filial_id IS NULL
          OR _filial_id = public.get_jwt_filial_id()
          -- Permissão explícita na tabela user_filial_access decide por conta própria
          OR EXISTS (
            SELECT 1 FROM public.user_filial_access
            WHERE user_id = auth.uid()
            AND filial_id = _filial_id
            AND can_view = true
          )
          -- Legado: sem filial primária no JWT E sem NENHUMA restrição
          -- granular configurada em user_filial_access NESTA igreja =>
          -- acesso total. Escopado por igreja_id pra não negar acesso
          -- legado por causa de uma row de OUTRA igreja (ex.: usuário que
          -- já pertenceu a outro tenant). Só se aplica quando não há
          -- nenhuma row pra ESTA igreja; se tiver, a allowlist acima já
          -- decidiu (allow ou deny).
          OR (
            public.get_jwt_filial_id() IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM public.user_filial_access
              WHERE user_id = auth.uid()
              AND igreja_id = _igreja_id
            )
          )
        )
      )
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.has_filial_access(UUID, UUID) IS
  'Verifica acesso de um usuário a uma filial. Admin global/de igreja têm
   acesso total. Caso contrário: filial_id NULL (compartilhada) ou igual à
   filial primária do JWT libera; senão, uma row explícita em
   user_filial_access (can_view=true) decide; o shortcut de "sem filial
   primária = acesso total" só vale quando o usuário não tem NENHUMA row
   em user_filial_access (comportamento legado, sem restrição granular
   configurada) — corrige bypass onde a allowlist granular era ignorada
   (achado PR #97, 2026-08-12).';

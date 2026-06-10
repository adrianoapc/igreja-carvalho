-- ============================================================
-- SANITIZE & BACKFILL profile_contatos
-- ============================================================
update public.profile_contatos
set tipo = 'celular'
where tipo = 'telefone';

update public.profile_contatos
set valor = regexp_replace(valor, '\D', '', 'g')
where tipo in ('celular', 'fixo')
  and valor is not null;

update public.profile_contatos
set valor = lower(trim(valor))
where tipo = 'email'
  and valor is not null;

insert into public.profile_contatos (
  profile_id, tipo, valor, rotulo, is_primary, is_whatsapp, is_login, created_at, updated_at
)
select
  p.id as profile_id,
  case when length(regexp_replace(p.telefone, '\D', '', 'g')) >= 11 then 'celular' else 'fixo' end as tipo,
  regexp_replace(p.telefone, '\D', '', 'g') as valor,
  'Pessoal' as rotulo,
  true as is_primary,
  false as is_whatsapp,
  false as is_login,
  now(),
  now()
from public.profiles p
where p.telefone is not null
  and trim(p.telefone) <> ''
  and not exists (
    select 1 from public.profile_contatos pc
    where pc.profile_id = p.id
      and pc.tipo in ('celular', 'fixo', 'telefone')
      and regexp_replace(pc.valor, '\D', '', 'g') = regexp_replace(p.telefone, '\D', '', 'g')
  );

insert into public.profile_contatos (
  profile_id, tipo, valor, rotulo, is_primary, is_whatsapp, is_login, created_at, updated_at
)
select
  p.id as profile_id,
  'email' as tipo,
  lower(trim(p.email)) as valor,
  'Pessoal' as rotulo,
  true as is_primary,
  false as is_whatsapp,
  true as is_login,
  now(),
  now()
from public.profiles p
where p.email is not null
  and trim(p.email) <> ''
  and not exists (
    select 1 from public.profile_contatos pc
    where pc.profile_id = p.id
      and pc.tipo = 'email'
      and lower(trim(pc.valor)) = lower(trim(p.email))
  );

with ranked as (
  select id,
    row_number() over (partition by profile_id, tipo order by is_primary desc, created_at asc, id asc) as rn
  from public.profile_contatos
)
update public.profile_contatos pc
set is_primary = (r.rn = 1)
from ranked r
where pc.id = r.id;

update public.profile_contatos pc
set is_login = true
where pc.tipo = 'email'
  and pc.is_primary = true
  and coalesce(pc.is_login, false) = false;

-- ============================================================
-- OTP: índice e função de limpeza
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_otp_verificacao_expira_em
  ON public.otp_verificacao (expira_em)
  WHERE usado = false;

CREATE OR REPLACE FUNCTION public.limpar_otps_expirados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deletados integer;
BEGIN
  DELETE FROM public.otp_verificacao
  WHERE expira_em < now() - interval '1 hour'
     OR (usado = true AND created_at < now() - interval '24 hours');
  GET DIAGNOSTICS deletados = ROW_COUNT;
  RETURN deletados;
END;
$$;

-- ============================================================
-- OTP WhatsApp v2: colunas e índices
-- ============================================================
ALTER TABLE public.otp_verificacao
  ADD COLUMN IF NOT EXISTS codigo_hash TEXT,
  ADD COLUMN IF NOT EXISTS wamid       TEXT,
  ADD COLUMN IF NOT EXISTS meta_error  TEXT;

CREATE INDEX IF NOT EXISTS idx_otp_rate_limit
  ON public.otp_verificacao (telefone, created_at DESC)
  WHERE tipo = 'whatsapp';

CREATE INDEX IF NOT EXISTS idx_otp_codigo_hash
  ON public.otp_verificacao (telefone, codigo_hash)
  WHERE usado = false AND codigo_hash IS NOT NULL;

-- ============================================================
-- profile_contatos: policy staff SELECT
-- ============================================================
DROP POLICY IF EXISTS "Church staff can view contacts in same filial" ON public.profile_contatos;

CREATE POLICY "Church staff can view contacts in same filial"
ON public.profile_contatos FOR SELECT
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
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = profile_contatos.profile_id
      AND has_filial_access(profiles.igreja_id, profiles.filial_id)
  )
);

-- ============================================================
-- append_fila_pendente RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.append_fila_pendente(
  p_sessao_id UUID,
  p_igreja_id UUID,
  p_item JSONB
) RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.atendimentos_bot
    SET meta_dados = jsonb_set(
      meta_dados,
      '{fila_pendente}',
      COALESCE(meta_dados -> 'fila_pendente', '[]'::jsonb) || jsonb_build_array(p_item),
      true
    )
    WHERE id = p_sessao_id
      AND igreja_id = p_igreja_id
    RETURNING meta_dados -> 'fila_pendente' AS fila
  )
  SELECT COALESCE(jsonb_array_length(fila), 0) FROM updated;
$$;

REVOKE ALL ON FUNCTION public.append_fila_pendente(UUID, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_fila_pendente(UUID, UUID, JSONB) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_fila_pendente(UUID, UUID, JSONB) TO service_role;

-- ============================================================
-- short_links: policy e grant anon
-- ============================================================
DROP POLICY IF EXISTS "short_links_select_same_church" ON public.short_links;

GRANT SELECT ON public.short_links TO anon;

CREATE POLICY "short_links_select_public"
ON public.short_links
FOR SELECT
TO anon, authenticated
USING (expires_at IS NULL OR expires_at > now());

-- ============================================================
-- visitante_contatos: responsável opcional + policies staff
-- ============================================================
ALTER TABLE public.visitante_contatos
  ALTER COLUMN membro_responsavel_id DROP NOT NULL;

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
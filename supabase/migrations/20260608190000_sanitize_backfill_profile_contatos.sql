-- Sanitização e backfill de contatos legados para profile_contatos
-- Objetivo:
-- 1) Normalizar tipos/valores existentes em profile_contatos
-- 2) Inserir contatos faltantes vindos de profiles.telefone/email
-- 3) Garantir consistência mínima de contato principal por tipo

-- 1) Normalizar tipos antigos
update public.profile_contatos
set tipo = 'celular'
where tipo = 'telefone';

-- 2) Sanitizar valores
update public.profile_contatos
set valor = regexp_replace(valor, '\\D', '', 'g')
where tipo in ('celular', 'fixo')
  and valor is not null;

update public.profile_contatos
set valor = lower(trim(valor))
where tipo = 'email'
  and valor is not null;

-- 3) Backfill de telefone legados (somente se não existir equivalente)
insert into public.profile_contatos (
  profile_id,
  tipo,
  valor,
  rotulo,
  is_primary,
  is_whatsapp,
  is_login,
  created_at,
  updated_at
)
select
  p.id as profile_id,
  case
    when length(regexp_replace(p.telefone, '\\D', '', 'g')) >= 11 then 'celular'
    else 'fixo'
  end as tipo,
  regexp_replace(p.telefone, '\\D', '', 'g') as valor,
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
    select 1
    from public.profile_contatos pc
    where pc.profile_id = p.id
      and pc.tipo in ('celular', 'fixo', 'telefone')
      and regexp_replace(pc.valor, '\\D', '', 'g') = regexp_replace(p.telefone, '\\D', '', 'g')
  );

-- 4) Backfill de email legado (somente se não existir equivalente)
insert into public.profile_contatos (
  profile_id,
  tipo,
  valor,
  rotulo,
  is_primary,
  is_whatsapp,
  is_login,
  created_at,
  updated_at
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
    select 1
    from public.profile_contatos pc
    where pc.profile_id = p.id
      and pc.tipo = 'email'
      and lower(trim(pc.valor)) = lower(trim(p.email))
  );

-- 5) Garantir apenas um principal por profile/tipo
with ranked as (
  select
    id,
    row_number() over (
      partition by profile_id, tipo
      order by is_primary desc, created_at asc, id asc
    ) as rn
  from public.profile_contatos
)
update public.profile_contatos pc
set is_primary = (r.rn = 1)
from ranked r
where pc.id = r.id;

-- 6) Se existir email sem login, garantir principal com is_login=true
update public.profile_contatos pc
set is_login = true
where pc.tipo = 'email'
  and pc.is_primary = true
  and coalesce(pc.is_login, false) = false;

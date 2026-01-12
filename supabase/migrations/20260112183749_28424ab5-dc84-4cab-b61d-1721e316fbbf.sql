-- Financeiro: RPCs para sessões de contagem e confronto

create or replace function public.open_sessao_contagem(
  p_igreja_id uuid,
  p_filial_id uuid,
  p_data_culto date,
  p_periodo text
)
returns public.sessoes_contagem
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg record;
  v_existing public.sessoes_contagem%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth.uid() is null';
  end if;

  -- Permissão: admin da mesma igreja
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_uid and ur.role::text = 'admin' and ur.igreja_id = p_igreja_id
  ) then
    raise exception 'permission denied';
  end if;

  -- Evitar duplicidade: sessão já aberta para mesmo dia/periodo
  select * into v_existing
  from public.sessoes_contagem s
  where s.igreja_id = p_igreja_id
    and (s.filial_id is not distinct from p_filial_id)
    and s.data_culto = p_data_culto
    and s.periodo = p_periodo
    and s.status <> 'cancelado'
  limit 1;

  if v_existing.id is not null then
    return v_existing;
  end if;

  -- Buscar configuração por prioridade: filial > igreja
  select * into v_cfg
  from public.financeiro_config fc
  where fc.igreja_id = p_igreja_id
    and (fc.filial_id is not distinct from p_filial_id)
  order by fc.filial_id nulls last
  limit 1;

  if v_cfg is null then
    -- defaults caso não exista config
    insert into public.sessoes_contagem(
      igreja_id, filial_id, data_culto, periodo,
      status,
      blind_count_mode, blind_min_counters, blind_tolerance_value, blind_compare_level, blind_lock_totals,
      sync_strategy,
      created_by
    ) values (
      p_igreja_id, p_filial_id, p_data_culto, p_periodo,
      'aberto',
      'optional', 2, 0, 'total', true,
      'webhook',
      v_uid
    ) returning * into v_existing;
  else
    insert into public.sessoes_contagem(
      igreja_id, filial_id, data_culto, periodo,
      status,
      blind_count_mode, blind_min_counters, blind_tolerance_value, blind_compare_level, blind_lock_totals,
      sync_strategy,
      created_by
    ) values (
      p_igreja_id, p_filial_id, p_data_culto, p_periodo,
      'aberto',
      v_cfg.blind_count_mode, v_cfg.blind_min_counters, v_cfg.blind_tolerance_value, v_cfg.blind_compare_level, v_cfg.blind_lock_totals,
      v_cfg.sync_strategy,
      v_uid
    ) returning * into v_existing;
  end if;

  return v_existing;
end;
$$;

comment on function public.open_sessao_contagem(uuid, uuid, date, text)
  is 'Abre sessão de contagem com snapshot de parâmetros da configuração financeiro_config.';

grant execute on function public.open_sessao_contagem(uuid, uuid, date, text) to authenticated;


-- Confrontar contagens (conferência cega)
create or replace function public.confrontar_contagens(
  p_sessao_id uuid
)
returns table (
  status text,
  variance_value numeric,
  variance_by_tipo jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_s public.sessoes_contagem%rowtype;
  v_min numeric := 0;
  v_max numeric := 0;
  v_tolerance numeric := 0;
  v_n int := 0;
  v_status text := 'aguardando_conferencia';
  v_variance_by_tipo jsonb := '{}'::jsonb;
  v_ok boolean := false;
begin
  if v_uid is null then
    raise exception 'auth.uid() is null';
  end if;

  -- Carregar sessão e checar permissão admin
  select * into v_s from public.sessoes_contagem where id = p_sessao_id;
  if v_s.id is null then
    raise exception 'sessao not found';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_uid and ur.role::text = 'admin' and ur.igreja_id = v_s.igreja_id
  ) then
    raise exception 'permission denied';
  end if;

  v_tolerance := coalesce(v_s.blind_tolerance_value, 0);

  -- Número de conferentes
  select count(*) into v_n from public.contagens c where c.sessao_id = p_sessao_id;
  if v_n < coalesce(v_s.blind_min_counters, 2) then
    v_status := 'aguardando_conferencia';
    update public.sessoes_contagem set status = v_status, updated_at = now() where id = p_sessao_id;
    return query select v_status, null::numeric, null::jsonb;
    return;
  end if;

  if v_s.blind_compare_level = 'total' then
    -- Comparar total
    select min(c.total), max(c.total) into v_min, v_max
    from public.contagens c where c.sessao_id = p_sessao_id;
    if v_max - v_min <= v_tolerance then
      v_status := 'validado';
      v_ok := true;
    else
      v_status := 'divergente';
    end if;
    update public.sessoes_contagem
      set status = v_status,
          variance_value = (v_max - v_min),
          variance_by_tipo = null,
          updated_at = now()
    where id = p_sessao_id;
    return query select v_status, (v_max - v_min), null::jsonb;
  else
    -- Comparar por tipo (chaves de totais_por_tipo)
    with keys as (
      select distinct key
      from (
        select jsonb_object_keys(c.totais_por_tipo) as key
        from public.contagens c
        where c.sessao_id = p_sessao_id
      ) t
    ), vari as (
      select k.key,
             (max((c.totais_por_tipo ->> k.key)::numeric) - min((c.totais_por_tipo ->> k.key)::numeric)) as diff
      from keys k
      join public.contagens c on c.sessao_id = p_sessao_id
      group by k.key
    )
    select coalesce(jsonb_object_agg(key, diff), '{}'::jsonb) into v_variance_by_tipo from vari;

    -- Definir status com base na maior divergência
    select coalesce(max((v_variance_by_tipo ->> key)::numeric), 0) into v_max
    from jsonb_object_keys(v_variance_by_tipo) as key;
    if v_max <= v_tolerance then
      v_status := 'validado';
      v_ok := true;
    else
      v_status := 'divergente';
    end if;

    update public.sessoes_contagem
      set status = v_status,
          variance_value = v_max,
          variance_by_tipo = v_variance_by_tipo,
          updated_at = now()
    where id = p_sessao_id;
    return query select v_status, v_max, v_variance_by_tipo;
  end if;
end;
$$;

comment on function public.confrontar_contagens(uuid)
  is 'Confronta contagens da sessão aplicando tolerância e nível de comparação (total/tipo).';

grant execute on function public.confrontar_contagens(uuid) to authenticated;
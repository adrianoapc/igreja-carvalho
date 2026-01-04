-- Cria tabela de auditoria para replicações
create table if not exists public.logs_auditoria_replicacao (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid,
  igreja_id uuid not null,
  filial_origem_id uuid not null,
  filiais_destino_ids uuid[] not null,
  tabelas text[] not null,
  overwrite boolean not null default false,
  resultado jsonb
);

alter table public.logs_auditoria_replicacao enable row level security;

create policy "Admins podem ver logs de replicacao" on public.logs_auditoria_replicacao
  for select using (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'admin_igreja'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
  );

create policy "Admins podem inserir logs de replicacao" on public.logs_auditoria_replicacao
  for insert with check (
    has_role(auth.uid(), 'admin'::app_role)
    or has_role(auth.uid(), 'admin_igreja'::app_role)
    or has_role(auth.uid(), 'super_admin'::app_role)
  );

create or replace function public.replicar_cadastros_para_filiais(
  p_igreja_id uuid,
  p_filial_origem_id uuid,
  p_filiais_destino_ids uuid[],
  p_tabelas text[],
  p_overwrite boolean default false,
  p_user_id uuid default auth.uid()
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_tables constant text[] := array[
    'contas',
    'centros_custo',
    'categorias_financeiras',
    'fornecedores',
    'formas_pagamento',
    'bases_ministeriais',
    'subcategorias_financeiras'
  ];
  tabela text;
  dest uuid;
  result jsonb := '{}'::jsonb;
  inserted_count int;
  updated_count int;
  skipped_count int;
  src record;
  existing_id uuid;
begin
  if p_igreja_id is null then
    raise exception 'igreja_id é obrigatório';
  end if;
  if p_filial_origem_id is null then
    raise exception 'filial_origem_id é obrigatório';
  end if;
  if p_filiais_destino_ids is null or array_length(p_filiais_destino_ids, 1) is null then
    raise exception 'filial_destino_ids é obrigatório';
  end if;
  if p_tabelas is null or array_length(p_tabelas, 1) is null then
    raise exception 'tabelas é obrigatório';
  end if;

  foreach tabela in array p_tabelas loop
    if not (tabela = any(allowed_tables)) then
      raise exception 'Tabela % não permitida', tabela;
    end if;
  end loop;

  foreach tabela in array p_tabelas loop
    inserted_count := 0;
    updated_count := 0;
    skipped_count := 0;

    foreach dest in array p_filiais_destino_ids loop
      if dest = p_filial_origem_id then
        continue;
      end if;

      if tabela = 'contas' then
        for src in
          select *
          from contas
          where igreja_id = p_igreja_id
            and filial_id = p_filial_origem_id
            and ativo = true
            and lower(coalesce(tipo, '')) <> 'tesouraria'
        loop
          select id into existing_id
          from contas
          where igreja_id = p_igreja_id
            and filial_id = dest
            and nome = src.nome
          limit 1;

          if existing_id is not null then
            if p_overwrite then
              update contas
              set tipo = src.tipo,
                  banco = src.banco,
                  agencia = src.agencia,
                  conta_numero = src.conta_numero,
                  saldo_inicial = src.saldo_inicial,
                  saldo_atual = src.saldo_atual,
                  observacoes = src.observacoes,
                  ativo = src.ativo,
                  updated_at = now()
              where id = existing_id;
              updated_count := updated_count + 1;
            else
              skipped_count := skipped_count + 1;
            end if;
          else
            insert into contas (
              nome,
              tipo,
              banco,
              agencia,
              conta_numero,
              saldo_inicial,
              saldo_atual,
              observacoes,
              ativo,
              igreja_id,
              filial_id
            ) values (
              src.nome,
              src.tipo,
              src.banco,
              src.agencia,
              src.conta_numero,
              src.saldo_inicial,
              src.saldo_atual,
              src.observacoes,
              src.ativo,
              p_igreja_id,
              dest
            );
            inserted_count := inserted_count + 1;
          end if;
        end loop;
      elsif tabela = 'centros_custo' then
        for src in
          select *
          from centros_custo
          where igreja_id = p_igreja_id
            and filial_id = p_filial_origem_id
            and ativo = true
        loop
          select id into existing_id
          from centros_custo
          where igreja_id = p_igreja_id
            and filial_id = dest
            and nome = src.nome
          limit 1;

          if existing_id is not null then
            if p_overwrite then
              update centros_custo
              set descricao = src.descricao,
                  base_ministerial_id = src.base_ministerial_id,
                  ativo = src.ativo,
                  updated_at = now()
              where id = existing_id;
              updated_count := updated_count + 1;
            else
              skipped_count := skipped_count + 1;
            end if;
          else
            insert into centros_custo (
              nome,
              descricao,
              base_ministerial_id,
              ativo,
              igreja_id,
              filial_id
            ) values (
              src.nome,
              src.descricao,
              src.base_ministerial_id,
              src.ativo,
              p_igreja_id,
              dest
            );
            inserted_count := inserted_count + 1;
          end if;
        end loop;
      elsif tabela = 'categorias_financeiras' then
        for src in
          select *
          from categorias_financeiras
          where igreja_id = p_igreja_id
            and filial_id = p_filial_origem_id
            and ativo = true
        loop
          select id into existing_id
          from categorias_financeiras
          where igreja_id = p_igreja_id
            and filial_id = dest
            and nome = src.nome
            and tipo = src.tipo
          limit 1;

          if existing_id is not null then
            if p_overwrite then
              update categorias_financeiras
              set cor = src.cor,
                  secao_dre = src.secao_dre,
                  ativo = src.ativo,
                  updated_at = now()
              where id = existing_id;
              updated_count := updated_count + 1;
            else
              skipped_count := skipped_count + 1;
            end if;
          else
            insert into categorias_financeiras (
              nome,
              tipo,
              cor,
              secao_dre,
              ativo,
              igreja_id,
              filial_id
            ) values (
              src.nome,
              src.tipo,
              src.cor,
              src.secao_dre,
              src.ativo,
              p_igreja_id,
              dest
            );
            inserted_count := inserted_count + 1;
          end if;
        end loop;
      elsif tabela = 'fornecedores' then
        for src in
          select *
          from fornecedores
          where igreja_id = p_igreja_id
            and filial_id = p_filial_origem_id
            and ativo = true
        loop
          select id into existing_id
          from fornecedores
          where igreja_id = p_igreja_id
            and filial_id = dest
            and nome = src.nome
          limit 1;

          if existing_id is not null then
            if p_overwrite then
              update fornecedores
              set tipo_pessoa = src.tipo_pessoa,
                  cpf_cnpj = src.cpf_cnpj,
                  email = src.email,
                  telefone = src.telefone,
                  endereco = src.endereco,
                  cidade = src.cidade,
                  estado = src.estado,
                  cep = src.cep,
                  observacoes = src.observacoes,
                  ativo = src.ativo,
                  updated_at = now()
              where id = existing_id;
              updated_count := updated_count + 1;
            else
              skipped_count := skipped_count + 1;
            end if;
          else
            insert into fornecedores (
              nome,
              tipo_pessoa,
              cpf_cnpj,
              email,
              telefone,
              endereco,
              cidade,
              estado,
              cep,
              observacoes,
              ativo,
              igreja_id,
              filial_id
            ) values (
              src.nome,
              src.tipo_pessoa,
              src.cpf_cnpj,
              src.email,
              src.telefone,
              src.endereco,
              src.cidade,
              src.estado,
              src.cep,
              src.observacoes,
              src.ativo,
              p_igreja_id,
              dest
            );
            inserted_count := inserted_count + 1;
          end if;
        end loop;
      elsif tabela = 'formas_pagamento' then
        for src in
          select *
          from formas_pagamento
          where igreja_id = p_igreja_id
            and filial_id = p_filial_origem_id
            and ativo = true
        loop
          select id into existing_id
          from formas_pagamento
          where igreja_id = p_igreja_id
            and filial_id = dest
            and nome = src.nome
          limit 1;

          if existing_id is not null then
            if p_overwrite then
              update formas_pagamento
              set ativo = src.ativo,
                  updated_at = now()
              where id = existing_id;
              updated_count := updated_count + 1;
            else
              skipped_count := skipped_count + 1;
            end if;
          else
            insert into formas_pagamento (
              nome,
              ativo,
              igreja_id,
              filial_id
            ) values (
              src.nome,
              src.ativo,
              p_igreja_id,
              dest
            );
            inserted_count := inserted_count + 1;
          end if;
        end loop;
      elsif tabela = 'bases_ministeriais' then
        for src in
          select *
          from bases_ministeriais
          where igreja_id = p_igreja_id
            and filial_id = p_filial_origem_id
            and ativo = true
        loop
          select id into existing_id
          from bases_ministeriais
          where igreja_id = p_igreja_id
            and filial_id = dest
            and titulo = src.titulo
          limit 1;

          if existing_id is not null then
            if p_overwrite then
              update bases_ministeriais
              set descricao = src.descricao,
                  responsavel_id = src.responsavel_id,
                  ativo = src.ativo,
                  updated_at = now()
              where id = existing_id;
              updated_count := updated_count + 1;
            else
              skipped_count := skipped_count + 1;
            end if;
          else
            insert into bases_ministeriais (
              titulo,
              descricao,
              responsavel_id,
              ativo,
              igreja_id,
              filial_id
            ) values (
              src.titulo,
              src.descricao,
              src.responsavel_id,
              src.ativo,
              p_igreja_id,
              dest
            );
            inserted_count := inserted_count + 1;
          end if;
        end loop;
      elsif tabela = 'subcategorias_financeiras' then
        for src in
          select *
          from subcategorias_financeiras
          where igreja_id = p_igreja_id
            and filial_id = p_filial_origem_id
            and ativo = true
        loop
          select id into existing_id
          from subcategorias_financeiras
          where igreja_id = p_igreja_id
            and filial_id = dest
            and nome = src.nome
            and categoria_id = src.categoria_id
          limit 1;

          if existing_id is not null then
            if p_overwrite then
              update subcategorias_financeiras
              set ativo = src.ativo,
                  updated_at = now()
              where id = existing_id;
              updated_count := updated_count + 1;
            else
              skipped_count := skipped_count + 1;
            end if;
          else
            insert into subcategorias_financeiras (
              nome,
              categoria_id,
              ativo,
              igreja_id,
              filial_id
            ) values (
              src.nome,
              src.categoria_id,
              src.ativo,
              p_igreja_id,
              dest
            );
            inserted_count := inserted_count + 1;
          end if;
        end loop;
      end if;
    end loop;

    result := result || jsonb_build_object(
      tabela,
      jsonb_build_object(
        'inserted', inserted_count,
        'updated', updated_count,
        'skipped', skipped_count
      )
    );
  end loop;

  insert into logs_auditoria_replicacao (
    user_id,
    igreja_id,
    filial_origem_id,
    filiais_destino_ids,
    tabelas,
    overwrite,
    resultado
  ) values (
    p_user_id,
    p_igreja_id,
    p_filial_origem_id,
    p_filiais_destino_ids,
    p_tabelas,
    p_overwrite,
    result
  );

  return result;
end;
$$;

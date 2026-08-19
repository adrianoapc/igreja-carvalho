-- Fecha 4 gaps de autorização encontrados na auditoria de segurança do
-- linter Supabase (achados "menores" da mesma rodada do fix de
-- save_permissions_batch/rollback_audit_batch em 20260818130000):
--
-- 1) set_webhook_secret / get_webhook_secret: SECURITY DEFINER, expostas
--    via RPC a anon/authenticated (EXECUTE nunca revogado), sem NENHUM
--    check interno. Na prática só são chamadas por
--    supabase/functions/set-webhook-secret (que já autoriza admin/
--    admin_igreja/super_admin da igreja alvo antes de repassar via
--    service_role) e por _shared/secrets.ts — nunca pelo frontend
--    diretamente, apesar do comentário desatualizado "usar via frontend"
--    em set_webhook_secret. Sem esse fix, qualquer authenticated podia
--    chamar a RPC direto (bypassando a Edge Function) e corromper/vazar
--    o secret de webhook de QUALQUER igreja, bastando adivinhar/possuir
--    uma chave de criptografia (get_webhook_secret) ou nenhuma (set,
--    que aceita qualquer p_encryption_key). Fix: restringe às duas só a
--    auth.role() = 'service_role' (mesmo padrão usado pela Supabase para
--    RPCs "internal-only"; não quebra a Edge Function, que já chama via
--    service_role key).
--
-- 2) replicar_cadastros_para_filiais: mesmo padrão — SECURITY DEFINER,
--    sem check interno algum, escreve em contas/categorias_financeiras/
--    fornecedores/formas_pagamento/subcategorias_financeiras/
--    centros_custo/bases_ministeriais (várias fazem parte do núcleo
--    financeiro) para QUALQUER p_igreja_id informado pelo caller. Única
--    chamadora é supabase/functions/replicar-cadastros (que já valida
--    admin/admin_igreja/super_admin daquela igreja via user_roles antes
--    de repassar via service_role). Mesmo fix: só auth.role() = 'service_role'.
--
-- 3) presencas_aula: policy "Auth pode ver presencas aula" tinha
--    USING (true) literal para authenticated — qualquer autenticado via
--    de QUALQUER igreja lia presença/checkin de aula de QUALQUER outra.
--    A tabela já tem igreja_id/filial_id (adicionados depois da criação
--    original); fix aplica has_filial_access, no mesmo padrão de
--    "Membros podem ver liturgia"/"Membros podem ver mídias".
--
-- 4) kids_diario: policy "Lideres gerenciam diarios" (FOR ALL) só
--    checava has_role(admin/lider/secretario), sem has_filial_access —
--    um líder de UMA igreja podia ler/escrever diário comportamental de
--    crianças de OUTRA igreja (dado sensível de menor). Tabela já tem
--    igreja_id/filial_id. Hoje a tabela está vazia em produção (0
--    linhas), mas o gap é real assim que houver dado. Como a policy é
--    FOR ALL sem WITH CHECK explícito, o Postgres usa o USING também
--    como WITH CHECK — então este fix cobre leitura E escrita num só
--    lugar.

CREATE OR REPLACE FUNCTION public.set_webhook_secret(
  p_igreja_id UUID,
  p_tipo TEXT,
  p_secret TEXT,
  p_encryption_key TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: função interna, chame via Edge Function' USING ERRCODE = '42501';
  END IF;

  UPDATE public.webhooks
  SET
    secret_encrypted = pgp_sym_encrypt(p_secret, p_encryption_key),
    secret_hint = RIGHT(p_secret, 4),
    secret = NULL,
    updated_at = now()
  WHERE igreja_id = p_igreja_id AND tipo = p_tipo;

  IF NOT FOUND THEN
    INSERT INTO public.webhooks (igreja_id, tipo, secret_encrypted, secret_hint, enabled)
    VALUES (
      p_igreja_id,
      p_tipo,
      pgp_sym_encrypt(p_secret, p_encryption_key),
      RIGHT(p_secret, 4),
      true
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_webhook_secret(
  p_igreja_id UUID,
  p_tipo TEXT,
  p_encryption_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso negado: função interna, chame via Edge Function' USING ERRCODE = '42501';
  END IF;

  SELECT pgp_sym_decrypt(secret_encrypted, p_encryption_key)
  INTO v_secret
  FROM public.webhooks
  WHERE igreja_id = p_igreja_id
    AND tipo = p_tipo
    AND enabled = true
    AND secret_encrypted IS NOT NULL;

  RETURN v_secret;
END;
$$;

CREATE OR REPLACE FUNCTION public.replicar_cadastros_para_filiais(
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
  if auth.role() is distinct from 'service_role' then
    raise exception 'Acesso negado: função interna, chame via Edge Function' using errcode = '42501';
  end if;

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

DROP POLICY IF EXISTS "Auth pode ver presencas aula" ON public.presencas_aula;
CREATE POLICY "Auth pode ver presencas aula" ON public.presencas_aula
  FOR SELECT TO authenticated
  USING (public.has_filial_access(igreja_id, filial_id));

DROP POLICY IF EXISTS "Lideres gerenciam diarios" ON public.kids_diario;
CREATE POLICY "Lideres gerenciam diarios" ON public.kids_diario
  FOR ALL
  USING (
    (
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'lider'::app_role) OR
      has_role(auth.uid(), 'secretario'::app_role)
    )
    AND public.has_filial_access(igreja_id, filial_id)
  );

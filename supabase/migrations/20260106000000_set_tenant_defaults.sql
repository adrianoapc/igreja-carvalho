-- Migração para garantir que inserts sempre recebam igreja_id/filial_id do contexto JWT
-- Aplica triggers automáticas em todas as tabelas que possuem colunas igreja_id e/ou filial_id

DO $$
DECLARE
  rec RECORD;
  fn_sql TEXT;
  trigger_name TEXT;
BEGIN
  FOR rec IN
    SELECT
      table_schema,
      table_name,
      bool_or(column_name = 'igreja_id') AS has_igreja,
      bool_or(column_name = 'filial_id') AS has_filial
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('igreja_id', 'filial_id')
    GROUP BY table_schema, table_name
  LOOP
    -- Monta função específica para a tabela, setando apenas as colunas existentes
    fn_sql := format($body$
      CREATE OR REPLACE FUNCTION public.set_tenant_defaults_%I()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $func$
      BEGIN
        %s
        %s
        RETURN NEW;
      END;
      $func$;
    $body$,
      rec.table_name,
      CASE WHEN rec.has_igreja THEN 'IF NEW.igreja_id IS NULL THEN NEW.igreja_id := public.get_jwt_igreja_id(); END IF;' ELSE '' END,
      CASE WHEN rec.has_filial THEN 'IF NEW.filial_id IS NULL THEN NEW.filial_id := public.get_jwt_filial_id(); END IF;' ELSE '' END
    );

    EXECUTE fn_sql;

    trigger_name := 'set_tenant_defaults';
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', trigger_name, rec.table_schema, rec.table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_defaults_%I();',
      trigger_name,
      rec.table_schema,
      rec.table_name,
      rec.table_name
    );
  END LOOP;
END $$;
